// ---------------------------------------------------------------------------
// sign_message.rs — JWS signing for lane messages
//
// Port of scripts/sign-outbox-message.js
// Supports Ed25519 (EdDSA) and RSA (RS256 via RSASSA-PKCS1-v1_5 with SHA-256)
// ---------------------------------------------------------------------------

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use ed25519_dalek::Signer;
use pkcs8::{DecodePrivateKey, DecodePublicKey, EncodePublicKey};
use rsa::signature::SignatureEncoding;
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::io::Write;
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
pub struct SignResult {
    pub status: String, // "ok" | "error"
    pub message: String,
    pub key_id: Option<String>,
    pub signature: Option<String>,
}

impl SignResult {
    pub fn ok(
        message: impl Into<String>,
        key_id: Option<String>,
        signature: Option<String>,
    ) -> Self {
        SignResult {
            status: "ok".into(),
            message: message.into(),
            key_id,
            signature,
        }
    }
    pub fn err(message: impl Into<String>) -> Self {
        SignResult {
            status: "error".into(),
            message: message.into(),
            key_id: None,
            signature: None,
        }
    }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

enum KeyType {
    Ed25519,
    Rsa,
}

// ---------------------------------------------------------------------------
// Lane identity directory mapping
// ---------------------------------------------------------------------------

const LANE_IDENTITY_DIRS: &[(&str, &str)] = &[
    ("archivist", ".identity"),
    ("authority", ".identity/authority"),
    ("library", "../self-organizing-library/.identity"),
    ("swarmmind", "../SwarmMind/.identity"),
    ("kernel", "../kernel-lane/.identity"),
];

/// Resolve lane identity directory relative to project root.
fn resolve_identity_dir(project_root: &Path, lane: &str) -> Result<PathBuf, String> {
    for (name, rel) in LANE_IDENTITY_DIRS {
        if *name == lane {
            let p = project_root.join(rel);
            return Ok(p);
        }
    }
    Err(format!(
        "UNKNOWN_LANE: no identity mapping for lane '{}'",
        lane
    ))
}

// ---------------------------------------------------------------------------
// Passphrase resolution
// ---------------------------------------------------------------------------

fn resolve_passphrase(project_root: &Path, lane: &str) -> Option<String> {
    // 1. Check env vars
    if let Ok(val) = std::env::var("LANE_KEY_PASSPHRASE") {
        if !val.is_empty() {
            return Some(val);
        }
    }
    let lane_upper = lane.to_uppercase();
    if let Ok(val) = std::env::var(format!("LANE_KEY_PASSPHRASE_{}", lane_upper)) {
        if !val.is_empty() {
            return Some(val);
        }
    }

    // 2. Check .runtime/lane-passphrases.json
    let passfile = project_root.join(".runtime/lane-passphrases.json");
    if passfile.exists() {
        if let Ok(content) = std::fs::read_to_string(&passfile) {
            if let Ok(parsed) = serde_json::from_str::<Value>(&content) {
                if let Some(entry) = parsed.get(lane) {
                    return match entry {
                        Value::String(s) => Some(s.clone()),
                        Value::Object(map) => map
                            .get("passphrase")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        _ => None,
                    };
                }
            }
        }
    }

    None
}

// ---------------------------------------------------------------------------
// Base64URL encoding (RFC 4648 §5, no padding)
// ---------------------------------------------------------------------------

fn base64url_encode(input: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(input)
}

// ---------------------------------------------------------------------------
// Stable JSON stringification (sorted keys, compact, matching JS behavior)
// ---------------------------------------------------------------------------

fn stable_stringify(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::String(s) => {
            // serde_json::to_string produces a properly escaped JSON string with quotes
            serde_json::to_string(s).unwrap_or_else(|_| format!("\"{}\"", s))
        }
        Value::Array(arr) => {
            let inner: Vec<String> = arr.iter().map(stable_stringify).collect();
            format!("[{}]", inner.join(","))
        }
        Value::Object(obj) => {
            let mut keys: Vec<&String> = obj.keys().collect();
            keys.sort();
            let inner: Vec<String> = keys
                .iter()
                .map(|k| {
                    let key = serde_json::to_string(k).unwrap_or_else(|_| format!("\"{}\"", k));
                    let val = stable_stringify(&obj[*k]);
                    format!("{}:{}", key, val)
                })
                .collect();
            format!("{{{}}}", inner.join(","))
        }
    }
}

// ---------------------------------------------------------------------------
// Key ID derivation: SHA-256(DER SPKI) → first 16 hex chars
// ---------------------------------------------------------------------------

/// Detect whether a PEM private key is encrypted (contains "ENCRYPTED").
fn is_pem_encrypted(pem: &str) -> bool {
    pem.contains("ENCRYPTED")
}

/// Derive a 16-char hex key_id from a PEM public key.
/// Method: SHA-256 of DER-encoded SPKI, first 16 hex characters.
#[allow(dead_code)]
fn derive_key_id_from_pem(public_key_pem: &str) -> Result<String, String> {
    // Try Ed25519
    if let Ok(verifying_key) = ed25519_dalek::VerifyingKey::from_public_key_pem(public_key_pem) {
        use pkcs8::EncodePublicKey;
        let der = verifying_key
            .to_public_key_der()
            .map_err(|e| format!("Ed25519 DER export failed: {}", e))?;
        let hash = Sha256::digest(der.as_bytes());
        let hex: String = hash[..8].iter().map(|b| format!("{:02x}", b)).collect();
        return Ok(hex);
    }

    // Try RSA
    if let Ok(public_key) = rsa::RsaPublicKey::from_public_key_pem(public_key_pem) {
        use pkcs8::EncodePublicKey;
        let der = public_key
            .to_public_key_der()
            .map_err(|e| format!("RSA DER export failed: {}", e))?;
        let hash = Sha256::digest(der.as_bytes());
        let hex: String = hash[..8].iter().map(|b| format!("{:02x}", b)).collect();
        return Ok(hex);
    }

    Err("Cannot derive key_id: unsupported public key format".to_string())
}

// ---------------------------------------------------------------------------
// Key material loading
// ---------------------------------------------------------------------------

fn load_signing_key(
    private_key_pem: &str,
    passphrase: Option<&str>,
) -> Result<(KeyType, String, String), String> {
    // Check for encrypted PEM early
    if is_pem_encrypted(private_key_pem) {
        if passphrase.is_none() {
            return Err("PASSPHRASE_MISSING: key is encrypted but no passphrase found".to_string());
        }
        // Encrypted PKCS#8 keys are not yet supported in the native port.
        // The JS implementation handled this via Node.js crypto.createPrivateKey.
        // For now, use the Node.js fallback for encrypted keys.
        return Err(
            "ENCRYPTED_KEY_UNSUPPORTED: encrypted PKCS#8 keys require Node.js fallback. \
             Use an unencrypted Ed25519 key or run sign-outbox-message.js directly."
                .to_string(),
        );
    }

    // Try Ed25519 first
    if let Ok(signing_key) = ed25519_dalek::SigningKey::from_pkcs8_pem(private_key_pem) {
        let verifying_key = signing_key.verifying_key();
        let der = verifying_key
            .to_public_key_der()
            .map_err(|e| format!("Ed25519 DER export failed: {}", e))?;
        let hash = Sha256::digest(der.as_bytes());
        let key_id: String = hash[..8].iter().map(|b| format!("{:02x}", b)).collect();
        return Ok((KeyType::Ed25519, key_id, "EdDSA".to_string()));
    }

    // Try RSA (unencrypted)
    if let Ok(private_key) = rsa::RsaPrivateKey::from_pkcs8_pem(private_key_pem) {
        let public_key = rsa::RsaPublicKey::from(&private_key);
        let der = public_key
            .to_public_key_der()
            .map_err(|e| format!("RSA DER export failed: {}", e))?;
        let hash = Sha256::digest(der.as_bytes());
        let key_id: String = hash[..8].iter().map(|b| format!("{:02x}", b)).collect();
        return Ok((KeyType::Rsa, key_id, "RS256".to_string()));
    }

    Err("UNSUPPORTED_KEY: expected Ed25519 or RSA PKCS#8 private key PEM".to_string())
}

// ---------------------------------------------------------------------------
// Content hash computation
// ---------------------------------------------------------------------------

fn compute_content_hash(msg: &Value) -> String {
    let body = msg
        .get("body")
        .cloned()
        .unwrap_or(Value::String(String::new()));
    let payload = msg
        .get("payload")
        .cloned()
        .unwrap_or(Value::Object(serde_json::Map::new()));
    let content = serde_json::json!({ "body": body, "payload": payload });
    let stable = stable_stringify(&content);
    let hash = Sha256::digest(stable.as_bytes());
    format!("sha256:{:x}", hash)
}

// ---------------------------------------------------------------------------
// Sign an inbox-shaped message using loaded key material
// ---------------------------------------------------------------------------

fn sign_inbox_shape(
    msg: &Value,
    lane: &str,
    key_id: &str,
    key_type: &KeyType,
    algorithm_label: &str,
    private_key_pem: &str,
) -> Result<Value, String> {
    let from = msg
        .get("from")
        .or_else(|| msg.get("from_lane"))
        .and_then(|v| v.as_str())
        .unwrap_or(lane);
    let to = msg
        .get("to")
        .or_else(|| msg.get("to_lane"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let content_hash = compute_content_hash(msg);

    // JWS header
    let header = serde_json::json!({
        "alg": algorithm_label,
        "typ": "JWT",
        "kid": key_id
    });

    // JWS payload (JWT claims)
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let payload = serde_json::json!({
        "id": msg.get("id").or_else(|| msg.get("task_id")).and_then(|v| {
            if v.is_null() { None } else { v.as_str().map(|s| Value::String(s.to_string())) }
        }).unwrap_or(Value::Null),
        "task_id": msg.get("task_id").and_then(|v| {
            if v.is_null() { None } else { v.as_str().map(|s| Value::String(s.to_string())) }
        }).unwrap_or(Value::Null),
        "from": from,
        "to": if to.is_empty() { Value::Null } else { Value::String(to.to_string()) },
        "lane": from,
        "priority": msg.get("priority").and_then(|v| {
            if v.is_null() { None } else { v.as_str().map(|s| Value::String(s.to_string())) }
        }).unwrap_or(Value::Null),
        "content_hash": &content_hash,
        "iat": now,
        "exp": now + 86400
    });

    // Build signing input: base64url(header) . base64url(payload)
    let header_b64 = base64url_encode(
        serde_json::to_string(&header)
            .unwrap_or_default()
            .as_bytes(),
    );
    let payload_b64 = base64url_encode(stable_stringify(&payload).as_bytes());
    let signing_input = format!("{}.{}", header_b64, payload_b64);

    // Sign
    let signature_bytes = match key_type {
        KeyType::Ed25519 => {
            let signing_key = ed25519_dalek::SigningKey::from_pkcs8_pem(private_key_pem)
                .map_err(|e| format!("Ed25519 key parse failed: {}", e))?;
            let signature: ed25519_dalek::Signature = signing_key.sign(signing_input.as_bytes());
            signature.to_vec()
        }
        KeyType::Rsa => {
            use rand::rngs::OsRng;
            use rsa::pkcs1v15::SigningKey;
            use rsa::signature::RandomizedSigner;

            let private_key = rsa::RsaPrivateKey::from_pkcs8_pem(private_key_pem)
                .map_err(|e| format!("RSA key parse failed: {}", e))?;
            let signing_key = SigningKey::<Sha256>::new_unprefixed(private_key);
            let signature: rsa::pkcs1v15::Signature =
                signing_key.sign_with_rng(&mut OsRng, signing_input.as_bytes());
            signature.to_vec()
        }
    };

    let signature_b64 = base64url_encode(&signature_bytes);
    let jws = format!("{}.{}", signing_input, signature_b64);

    // Build signed message output
    let mut signed = msg.clone();
    if let Value::Object(ref mut map) = signed {
        map.insert("from".to_string(), Value::String(from.to_string()));
        map.insert(
            "to".to_string(),
            if to.is_empty() {
                Value::Null
            } else {
                Value::String(to.to_string())
            },
        );
        map.insert("content_hash".to_string(), Value::String(content_hash));
        map.insert("signature".to_string(), Value::String(jws));
        map.insert(
            "signature_alg".to_string(),
            Value::String(algorithm_label.to_string()),
        );
        map.insert("key_id".to_string(), Value::String(key_id.to_string()));
    }

    Ok(signed)
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

fn atomic_write_json(path: &Path, value: &Value) -> Result<(), String> {
    let dir = path.parent().unwrap_or(Path::new("."));
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Cannot create directory {}: {}", dir.display(), e))?;

    let tmp = path.with_extension("tmp");
    let json = serde_json::to_string_pretty(value)
        .map_err(|e| format!("JSON serialization error: {}", e))?;
    {
        let mut f = std::fs::File::create(&tmp)
            .map_err(|e| format!("Cannot create temp file {}: {}", tmp.display(), e))?;
        f.write_all(json.as_bytes())
            .map_err(|e| format!("Write error to {}: {}", tmp.display(), e))?;
        f.sync_all()
            .map_err(|e| format!("Sync error for {}: {}", tmp.display(), e))?;
    }
    std::fs::rename(&tmp, path).map_err(|e| {
        format!(
            "Cannot rename {} to {}: {}",
            tmp.display(),
            path.display(),
            e
        )
    })?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Public API: sign a message file
// ---------------------------------------------------------------------------

pub fn sign_message_file(message_path: &Path, lane: Option<&str>, force: bool) -> SignResult {
    let absolute = if message_path.is_absolute() {
        message_path.to_path_buf()
    } else {
        match std::env::current_dir() {
            Ok(cwd) => cwd.join(message_path),
            Err(_) => return SignResult::err("Cannot resolve current directory".to_string()),
        }
    };

    if !absolute.exists() {
        return SignResult::err(format!("MESSAGE_FILE_MISSING: {}", absolute.display()));
    }

    let raw = match std::fs::read_to_string(&absolute) {
        Ok(c) => c,
        Err(e) => return SignResult::err(format!("Cannot read {}: {}", absolute.display(), e)),
    };
    // Strip BOM if present
    let raw = raw.trim_start_matches('\u{feff}');

    let msg: Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(e) => return SignResult::err(format!("Cannot parse {}: {}", absolute.display(), e)),
    };

    let effective_lane = lane.or_else(|| {
        msg.get("from")
            .or_else(|| msg.get("from_lane"))
            .and_then(|v| v.as_str())
    });

    let effective_lane = match effective_lane {
        Some(l) => l,
        None => {
            return SignResult::err(
                "LANE_REQUIRED: provide lane or include from/from_lane in message".to_string(),
            )
        }
    };

    // Check if already signed (unless force)
    if !force {
        if msg.get("signature").and_then(|v| v.as_str()).is_some() {
            return SignResult::ok(
                format!("Already signed: {}", absolute.display()),
                msg.get("key_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                msg.get("signature")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            );
        }
        if msg.get("jws").and_then(|v| v.as_str()).is_some() {
            return SignResult::ok(
                format!("Already signed (jws): {}", absolute.display()),
                None,
                msg.get("jws")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            );
        }
    }

    // Resolve project root from message_path location
    // Walk up from the file until we find config/allowed_roots.json
    let project_root = resolve_project_root_from_path(&absolute);
    let project_root = match project_root {
        Some(p) => p,
        None => {
            return SignResult::err(
                "Cannot resolve project root — ensure config/allowed_roots.json exists".to_string(),
            )
        }
    };

    let identity_dir = match resolve_identity_dir(&project_root, effective_lane) {
        Ok(d) => d,
        Err(e) => return SignResult::err(e),
    };

    let private_path = identity_dir.join("private.pem");
    let public_path = identity_dir.join("public.pem");

    if !private_path.exists() || !public_path.exists() {
        return SignResult::err(format!("SIGNING_KEYS_MISSING: {}", identity_dir.display()));
    }

    let private_pem = match std::fs::read_to_string(&private_path) {
        Ok(c) => c,
        Err(e) => {
            return SignResult::err(format!(
                "Cannot read private key {}: {}",
                private_path.display(),
                e
            ))
        }
    };

    // Check if passphrase is needed
    let passphrase = resolve_passphrase(&project_root, effective_lane);
    if is_pem_encrypted(&private_pem) && passphrase.is_none() {
        return SignResult::err(format!(
            "PASSPHRASE_MISSING: no passphrase found for lane {}",
            effective_lane
        ));
    }

    // Load key material and get key_id
    let (key_type, key_id, algorithm_label) =
        match load_signing_key(&private_pem, passphrase.as_deref()) {
            Ok(t) => t,
            Err(e) => {
                return SignResult::err(format!(
                    "KEY_LOAD_FAILED for lane {}: {}",
                    effective_lane, e
                ))
            }
        };

    // Sign the message
    let signed = match sign_inbox_shape(
        &msg,
        effective_lane,
        &key_id,
        &key_type,
        &algorithm_label,
        &private_pem,
    ) {
        Ok(s) => s,
        Err(e) => return SignResult::err(e),
    };

    // Atomic write
    if let Err(e) = atomic_write_json(&absolute, &signed) {
        return SignResult::err(e);
    }

    let sig = signed
        .get("signature")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    SignResult::ok(
        format!("Signed {} with key_id={}", absolute.display(), key_id),
        Some(key_id),
        sig,
    )
}

/// Walk up from a file path to find the project root (where config/allowed_roots.json lives).
fn resolve_project_root_from_path(path: &Path) -> Option<PathBuf> {
    let mut current = if path.is_file() { path.parent()? } else { path }.to_path_buf();

    loop {
        if current.join("config/allowed_roots.json").exists() {
            return Some(current);
        }
        if !current.pop() {
            return None;
        }
    }
}

// ---------------------------------------------------------------------------
// Tauri command
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn sign_message(message_path: String, lane: Option<String>, force: Option<bool>) -> SignResult {
    let path = PathBuf::from(&message_path);

    // Validate path via safety module (checks allowed roots)
    #[cfg(not(test))]
    match crate::safety::validate_path(&path) {
        Ok(_) => {}
        Err(e) => {
            return SignResult::err(format!("Path validation failed: {}", e));
        }
    }

    let lane_str = lane.as_deref();
    let force_val = force.unwrap_or(false);

    sign_message_file(&path, lane_str, force_val)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::Path;

    /// Generate an Ed25519 key pair and return (private_pem, public_pem).
    fn generate_ed25519_keypair() -> (String, String) {
        let secret = [42u8; 32]; // deterministic for tests
        let signing_key = ed25519_dalek::SigningKey::from_bytes(&secret);
        let verifying_key = signing_key.verifying_key();

        use pkcs8::EncodePrivateKey;
        use pkcs8::EncodePublicKey;

        let private_pem = signing_key
            .to_pkcs8_pem(Default::default())
            .expect("Ed25519 private key PEM export")
            .to_string();
        let public_pem = verifying_key
            .to_public_key_pem(Default::default())
            .expect("Ed25519 public key PEM export")
            .to_string();

        (private_pem, public_pem)
    }

    fn with_temp_dir<F>(f: F)
    where
        F: FnOnce(&Path),
    {
        let dir = tempfile::tempdir().expect("temp dir");
        f(dir.path());
    }

    fn create_json(path: &Path, content: &Value) {
        let parent = path.parent().unwrap();
        std::fs::create_dir_all(parent).ok();
        let mut file = std::fs::File::create(path).unwrap();
        file.write_all(serde_json::to_string_pretty(content).unwrap().as_bytes())
            .unwrap();
    }

    fn create_file(path: &Path, content: &str) {
        let parent = path.parent().unwrap();
        std::fs::create_dir_all(parent).ok();
        let mut file = std::fs::File::create(path).unwrap();
        file.write_all(content.as_bytes()).unwrap();
    }

    // -----------------------------------------------------------------------
    // base64url_encode tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_base64url_encode_basic() {
        assert_eq!(base64url_encode(b"hello"), "aGVsbG8");
        assert_eq!(base64url_encode(b""), "");
    }

    #[test]
    fn test_base64url_encode_url_safe() {
        // Bytes that would contain + and / in regular base64
        let input: &[u8] = &[0x3e, 0xbf, 0xf8];
        let result = base64url_encode(input);
        assert!(!result.contains('+'), "should not contain +");
        assert!(!result.contains('/'), "should not contain /");
        assert!(!result.contains('='), "should not contain padding");
    }

    #[test]
    fn test_base64url_encode_no_padding() {
        let result = base64url_encode(b"f");
        assert!(!result.contains('='), "should not have padding");
    }

    // -----------------------------------------------------------------------
    // stable_stringify tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_stable_stringify_null() {
        assert_eq!(stable_stringify(&Value::Null), "null");
    }

    #[test]
    fn test_stable_stringify_bool() {
        assert_eq!(stable_stringify(&Value::Bool(true)), "true");
        assert_eq!(stable_stringify(&Value::Bool(false)), "false");
    }

    #[test]
    fn test_stable_stringify_number() {
        assert_eq!(stable_stringify(&serde_json::json!(2.5)), "2.5");
        assert_eq!(stable_stringify(&Value::String("".into())), "\"\"");
    }

    #[test]
    fn test_stable_stringify_string_escaping() {
        let s = Value::String("hello\nworld".into());
        let result = stable_stringify(&s);
        assert_eq!(result, "\"hello\\nworld\"");
    }

    #[test]
    fn test_stable_stringify_array() {
        let arr = serde_json::json!([3, 1, 2]);
        assert_eq!(stable_stringify(&arr), "[3,1,2]");
    }

    #[test]
    fn test_stable_stringify_object_sorted_keys() {
        let obj = serde_json::json!({"z": 1, "a": 2, "m": 3});
        assert_eq!(stable_stringify(&obj), r#"{"a":2,"m":3,"z":1}"#);
    }

    #[test]
    fn test_stable_stringify_nested() {
        let obj = serde_json::json!({
            "name": "test",
            "tags": ["a", "b"],
            "meta": {"count": 5, "active": true}
        });
        let result = stable_stringify(&obj);
        // Keys sorted: meta, name, tags
        assert_eq!(
            result,
            r#"{"meta":{"active":true,"count":5},"name":"test","tags":["a","b"]}"#
        );
    }

    // -----------------------------------------------------------------------
    // derive_key_id tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_derive_key_id_ed25519() {
        let (_private_pem, public_pem) = generate_ed25519_keypair();
        let key_id = derive_key_id_from_pem(&public_pem).expect("key_id derivation should succeed");
        assert_eq!(key_id.len(), 16, "key_id should be 16 hex chars");
        assert!(
            key_id.chars().all(|c| c.is_ascii_hexdigit()),
            "key_id should be hex"
        );
    }

    #[test]
    fn test_derive_key_id_deterministic() {
        let (_priv1, pub1) = generate_ed25519_keypair();
        let id1 = derive_key_id_from_pem(&pub1).unwrap();
        let id2 = derive_key_id_from_pem(&pub1).unwrap();
        assert_eq!(id1, id2, "key_id should be deterministic");
    }

    #[test]
    fn test_derive_key_id_different_keys() {
        // Generate a key with different seed
        let secret1 = [42u8; 32];
        let secret2 = [99u8; 32];
        let sk1 = ed25519_dalek::SigningKey::from_bytes(&secret1);
        let sk2 = ed25519_dalek::SigningKey::from_bytes(&secret2);

        use pkcs8::EncodePublicKey;
        let pub1 = sk1
            .verifying_key()
            .to_public_key_pem(Default::default())
            .unwrap()
            .to_string();
        let pub2 = sk2
            .verifying_key()
            .to_public_key_pem(Default::default())
            .unwrap()
            .to_string();

        let id1 = derive_key_id_from_pem(&pub1).unwrap();
        let id2 = derive_key_id_from_pem(&pub2).unwrap();
        assert_ne!(id1, id2, "different keys should produce different key_ids");
    }

    // -----------------------------------------------------------------------
    // content_hash tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_content_hash_with_body_and_payload() {
        let msg = serde_json::json!({
            "body": "Hello",
            "payload": {"action": "test"}
        });
        let hash = compute_content_hash(&msg);
        assert!(
            hash.starts_with("sha256:"),
            "hash should start with sha256:"
        );
        assert_eq!(hash.len(), 64 + 7, "sha256:prefix + 64 hex chars"); // "sha256:" (7) + 64 hex
    }

    #[test]
    fn test_content_hash_missing_fields_default() {
        let msg = serde_json::json!({"id": "123"});
        let hash = compute_content_hash(&msg);
        assert!(hash.starts_with("sha256:"));
        // Should be deterministic even with missing body/payload
        let hash2 = compute_content_hash(&msg);
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_content_hash_deterministic() {
        let msg = serde_json::json!({"body": "test", "payload": {}});
        let h1 = compute_content_hash(&msg);
        let h2 = compute_content_hash(&msg);
        assert_eq!(h1, h2);
    }

    // -----------------------------------------------------------------------
    // sign_inbox_shape tests (unit-level, using in-memory keys)
    // -----------------------------------------------------------------------

    #[test]
    fn test_sign_inbox_shape_ed25519_basic() {
        let (private_pem, _public_pem) = generate_ed25519_keypair();
        let (key_type, key_id, alg) = load_signing_key(&private_pem, None).unwrap();

        let msg = serde_json::json!({
            "body": "test message",
            "from": "archivist",
            "to": "swarmmind",
            "priority": "P1"
        });

        let signed = sign_inbox_shape(&msg, "archivist", &key_id, &key_type, &alg, &private_pem)
            .expect("signing should succeed");

        // Check signed fields
        assert!(signed.get("signature").is_some(), "should have signature");
        assert!(signed.get("key_id").is_some(), "should have key_id");
        assert!(
            signed.get("signature_alg").is_some(),
            "should have signature_alg"
        );
        assert!(
            signed.get("content_hash").is_some(),
            "should have content_hash"
        );

        assert_eq!(signed["from"], "archivist");
        assert_eq!(signed["to"], "swarmmind");
        assert_eq!(signed["signature_alg"], "EdDSA");
        assert_eq!(signed["key_id"], key_id);
    }

    #[test]
    fn test_sign_inbox_shape_preserves_original_fields() {
        let (private_pem, _public_pem) = generate_ed25519_keypair();
        let (key_type, key_id, alg) = load_signing_key(&private_pem, None).unwrap();

        let msg = serde_json::json!({
            "schema_version": "1.4",
            "task_id": "task-123",
            "body": "test",
            "from": "archivist"
        });

        let signed = sign_inbox_shape(&msg, "archivist", &key_id, &key_type, &alg, &private_pem)
            .expect("signing should succeed");

        assert_eq!(signed["schema_version"], "1.4");
        assert_eq!(signed["task_id"], "task-123");
        assert_eq!(signed["body"], "test");
    }

    #[test]
    fn test_sign_inbox_shape_uses_from_lane_fallback() {
        let (private_pem, _public_pem) = generate_ed25519_keypair();
        let (key_type, key_id, alg) = load_signing_key(&private_pem, None).unwrap();

        let msg = serde_json::json!({
            "from_lane": "kernel",
            "body": "test"
        });

        let signed = sign_inbox_shape(&msg, "kernel", &key_id, &key_type, &alg, &private_pem)
            .expect("signing should succeed");

        assert_eq!(signed["from"], "kernel");
    }

    #[test]
    fn test_sign_inbox_shape_jws_format() {
        let (private_pem, _public_pem) = generate_ed25519_keypair();
        let (key_type, key_id, alg) = load_signing_key(&private_pem, None).unwrap();

        let msg = serde_json::json!({
            "body": "test",
            "from": "archivist"
        });

        let signed = sign_inbox_shape(&msg, "archivist", &key_id, &key_type, &alg, &private_pem)
            .expect("signing should succeed");

        let jws = signed["signature"].as_str().unwrap();
        // JWS compact format: header.payload.signature (3 parts)
        let parts: Vec<&str> = jws.split('.').collect();
        assert_eq!(parts.len(), 3, "JWS should have 3 dot-separated parts");
        // All parts should be valid base64url (non-empty, no padding)
        for part in &parts {
            assert!(!part.is_empty(), "each JWS part should be non-empty");
            assert!(!part.contains('='), "JWS parts should not have padding");
        }
    }

    #[test]
    fn test_sign_inbox_shape_content_hash_variation() {
        let (private_pem, _public_pem) = generate_ed25519_keypair();
        let (key_type, key_id, alg) = load_signing_key(&private_pem, None).unwrap();

        let msg1 = serde_json::json!({"body": "hello", "from": "archivist"});
        let msg2 = serde_json::json!({"body": "world", "from": "archivist"});

        let s1 =
            sign_inbox_shape(&msg1, "archivist", &key_id, &key_type, &alg, &private_pem).unwrap();
        let s2 =
            sign_inbox_shape(&msg2, "archivist", &key_id, &key_type, &alg, &private_pem).unwrap();

        assert_ne!(
            s1["content_hash"], s2["content_hash"],
            "different bodies should produce different hashes"
        );
        assert_ne!(
            s1["signature"], s2["signature"],
            "different content should produce different signatures"
        );
    }

    // -----------------------------------------------------------------------
    // sign_message_file tests (file-based)
    // -----------------------------------------------------------------------

    fn setup_signing_test_env(root: &Path) -> (String, String) {
        // Create .identity directory with keys
        let identity_dir = root.join(".identity");
        std::fs::create_dir_all(&identity_dir).ok();

        let (private_pem, public_pem) = generate_ed25519_keypair();

        create_file(&identity_dir.join("private.pem"), &private_pem);
        create_file(&identity_dir.join("public.pem"), &public_pem);

        // Create config/allowed_roots.json so project root is detectable
        let config_dir = root.join("config");
        std::fs::create_dir_all(&config_dir).ok();
        create_json(
            &config_dir.join("allowed_roots.json"),
            &serde_json::json!({
                "allowed_roots": [root.to_string_lossy().to_string()],
                "blocked_roots": [],
                "read_only_mode": false
            }),
        );

        (private_pem, public_pem)
    }

    #[test]
    fn test_sign_message_file_basic() {
        with_temp_dir(|root| {
            setup_signing_test_env(root);

            // Create a message file
            let msg = serde_json::json!({
                "schema_version": "1.4",
                "task_id": "task-001",
                "from": "archivist",
                "to": "swarmmind",
                "body": "Test message",
                "priority": "P2"
            });
            let msg_path = root.join("test_message.json");
            create_json(&msg_path, &msg);

            // Sign it
            let result = sign_message_file(&msg_path, Some("archivist"), false);
            assert_eq!(
                result.status, "ok",
                "signing should succeed: {}",
                result.message
            );
            assert!(result.key_id.is_some(), "should return key_id");
            assert_eq!(result.key_id.as_ref().unwrap().len(), 16);

            // Verify the file was updated
            let content = std::fs::read_to_string(&msg_path).unwrap();
            let parsed: Value = serde_json::from_str(&content).unwrap();
            assert!(
                parsed.get("signature").is_some(),
                "signed file should have signature"
            );
            assert_eq!(parsed["signature_alg"], "EdDSA");
            assert_eq!(parsed["key_id"], result.key_id.unwrap());
        });
    }

    #[test]
    fn test_sign_message_file_missing_file() {
        with_temp_dir(|root| {
            let result =
                sign_message_file(&root.join("nonexistent.json"), Some("archivist"), false);
            assert_eq!(result.status, "error");
            assert!(result.message.contains("MESSAGE_FILE_MISSING"));
        });
    }

    #[test]
    fn test_sign_message_file_missing_keys() {
        with_temp_dir(|root| {
            // No .identity directory at all
            let msg = serde_json::json!({"body": "test", "from": "archivist"});
            let msg_path = root.join("msg.json");
            create_json(&msg_path, &msg);

            let result = sign_message_file(&msg_path, Some("archivist"), false);
            assert_eq!(result.status, "error");
            assert!(
                result.message.contains("SIGNING_KEYS_MISSING")
                    || result.message.contains("Cannot resolve project root")
            );
        });
    }

    #[test]
    fn test_sign_message_file_already_signed() {
        with_temp_dir(|root| {
            let (_priv, _pub) = setup_signing_test_env(root);

            // Create a message that already has a signature
            let msg = serde_json::json!({
                "from": "archivist",
                "body": "test",
                "signature": "already.signed.value"
            });
            let msg_path = root.join("signed_msg.json");
            create_json(&msg_path, &msg);

            let result = sign_message_file(&msg_path, Some("archivist"), false);
            assert_eq!(
                result.status, "ok",
                "should report already signed without error"
            );
            assert!(result.message.contains("Already signed"));

            // With force=true, should re-sign
            let result2 = sign_message_file(&msg_path, Some("archivist"), true);
            assert_eq!(result2.status, "ok", "force should re-sign");
        });
    }

    #[test]
    fn test_sign_message_file_jws_field() {
        with_temp_dir(|root| {
            setup_signing_test_env(root);

            // Message with jws field instead of signature
            let msg = serde_json::json!({
                "from": "archivist",
                "body": "test",
                "jws": "some.existing.jws"
            });
            let msg_path = root.join("jws_msg.json");
            create_json(&msg_path, &msg);

            let result = sign_message_file(&msg_path, Some("archivist"), false);
            assert_eq!(result.status, "ok");
            assert!(result.message.contains("Already signed"));
        });
    }

    #[test]
    fn test_sign_message_file_no_lane_provided_uses_from() {
        with_temp_dir(|root| {
            setup_signing_test_env(root);

            let msg = serde_json::json!({
                "from": "archivist",
                "body": "test"
            });
            let msg_path = root.join("auto_lane.json");
            create_json(&msg_path, &msg);

            // No lane provided — should extract from "from" field
            let result = sign_message_file(&msg_path, None, false);
            assert_eq!(
                result.status, "ok",
                "should resolve lane from msg.from: {}",
                result.message
            );
        });
    }

    #[test]
    fn test_sign_message_file_lane_required() {
        with_temp_dir(|root| {
            setup_signing_test_env(root);

            // Message without from or from_lane
            let msg = serde_json::json!({"body": "test"});
            let msg_path = root.join("no_lane.json");
            create_json(&msg_path, &msg);

            let result = sign_message_file(&msg_path, None, false);
            assert_eq!(result.status, "error");
            assert!(result.message.contains("LANE_REQUIRED"));
        });
    }

    #[test]
    fn test_atomic_write_json() {
        with_temp_dir(|root| {
            let file_path = root.join("atomic_test.json");
            let data = serde_json::json!({"hello": "world"});

            atomic_write_json(&file_path, &data).unwrap();
            assert!(file_path.exists(), "file should exist after atomic write");

            let content = std::fs::read_to_string(&file_path).unwrap();
            let parsed: Value = serde_json::from_str(&content).unwrap();
            assert_eq!(parsed["hello"], "world");
        });
    }

    #[test]
    fn test_resolve_project_root_from_path() {
        with_temp_dir(|root| {
            let config_dir = root.join("config");
            std::fs::create_dir_all(&config_dir).ok();
            create_file(&config_dir.join("allowed_roots.json"), "{}");

            let subdir = root.join("lanes/archivist/inbox");
            std::fs::create_dir_all(&subdir).ok();
            let msg_path = subdir.join("msg.json");
            create_file(&msg_path, "{}");

            let resolved = resolve_project_root_from_path(&msg_path);
            assert!(resolved.is_some(), "should resolve project root");
            // Compare by components to avoid \\?\ prefix differences on Windows
            let resolved = resolved.unwrap();
            let resolved_components: Vec<_> = resolved.components().collect();
            let root_components: Vec<_> = root.components().collect();
            assert_eq!(resolved_components, root_components);
        });
    }

    #[test]
    fn test_resolve_project_root_from_path_no_config() {
        with_temp_dir(|root| {
            let resolved = resolve_project_root_from_path(&root.join("some_file.txt"));
            assert!(resolved.is_none(), "should not resolve without config");
        });
    }

    // -----------------------------------------------------------------------
    // load_signing_key tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_load_signing_key_ed25519() {
        let (private_pem, _public_pem) = generate_ed25519_keypair();
        let (key_type, key_id, alg) = load_signing_key(&private_pem, None).unwrap();

        assert_eq!(key_id.len(), 16);
        assert_eq!(alg, "EdDSA");
        match key_type {
            KeyType::Ed25519 => {} // expected
            _ => panic!("Expected Ed25519 key type"),
        }
    }

    #[test]
    fn test_load_signing_key_invalid_pem() {
        let result = load_signing_key("not a valid pem", None);
        assert!(result.is_err(), "invalid PEM should fail");
    }

    #[test]
    fn test_is_pem_encrypted() {
        assert!(is_pem_encrypted(
            "-----BEGIN ENCRYPTED PRIVATE KEY-----\nblah"
        ));
        assert!(!is_pem_encrypted("-----BEGIN PRIVATE KEY-----\nblah"));
        assert!(!is_pem_encrypted("plain text"));
    }

    // -----------------------------------------------------------------------
    // resolve_passphrase tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_resolve_passphrase_env_var() {
        with_temp_dir(|root| {
            std::env::set_var("LANE_KEY_PASSPHRASE", "test-pass");
            let result = resolve_passphrase(root, "archivist");
            std::env::remove_var("LANE_KEY_PASSPHRASE");
            assert_eq!(result, Some("test-pass".to_string()));
        });
    }

    #[test]
    fn test_resolve_passphrase_lane_specific_env() {
        with_temp_dir(|root| {
            std::env::set_var("LANE_KEY_PASSPHRASE_ARCHIVIST", "arch-pass");
            let result = resolve_passphrase(root, "archivist");
            std::env::remove_var("LANE_KEY_PASSPHRASE_ARCHIVIST");
            assert_eq!(result, Some("arch-pass".to_string()));
        });
    }

    #[test]
    fn test_resolve_passphrase_file() {
        with_temp_dir(|root| {
            let runtime_dir = root.join(".runtime");
            std::fs::create_dir_all(&runtime_dir).ok();
            create_json(
                &runtime_dir.join("lane-passphrases.json"),
                &serde_json::json!({"archivist": {"passphrase": "file-pass"}}),
            );
            let result = resolve_passphrase(root, "archivist");
            assert_eq!(result, Some("file-pass".to_string()));
        });
    }

    #[test]
    fn test_resolve_passphrase_file_string_value() {
        with_temp_dir(|root| {
            let runtime_dir = root.join(".runtime");
            std::fs::create_dir_all(&runtime_dir).ok();
            create_json(
                &runtime_dir.join("lane-passphrases.json"),
                &serde_json::json!({"kernel": "simple-pass"}),
            );
            let result = resolve_passphrase(root, "kernel");
            assert_eq!(result, Some("simple-pass".to_string()));
        });
    }

    // -----------------------------------------------------------------------
    // verify that the JWS signature can be verified
    // -----------------------------------------------------------------------

    #[test]
    fn test_jws_verification_roundtrip() {
        let (private_pem, public_pem) = generate_ed25519_keypair();
        let (key_type, key_id, alg) = load_signing_key(&private_pem, None).unwrap();

        let msg = serde_json::json!({
            "body": "verify me",
            "from": "archivist",
            "to": "kernel"
        });

        let signed = sign_inbox_shape(&msg, "archivist", &key_id, &key_type, &alg, &private_pem)
            .expect("signing");

        let jws = signed["signature"].as_str().unwrap();
        let parts: Vec<&str> = jws.split('.').collect();
        assert_eq!(parts.len(), 3);

        let signing_input = format!("{}.{}", parts[0], parts[1]);
        let signature_bytes = URL_SAFE_NO_PAD
            .decode(parts[2])
            .expect("base64url decode signature");

        // Verify with ed25519_dalek
        let verifying_key = ed25519_dalek::VerifyingKey::from_public_key_pem(&public_pem)
            .expect("parse public key");
        let signature =
            ed25519_dalek::Signature::from_slice(&signature_bytes).expect("parse signature");

        let result = verifying_key.verify_strict(signing_input.as_bytes(), &signature);
        assert!(result.is_ok(), "signature should verify");
    }

    #[test]
    fn test_jws_tamper_detection() {
        let (private_pem, public_pem) = generate_ed25519_keypair();
        let (key_type, key_id, alg) = load_signing_key(&private_pem, None).unwrap();

        let msg = serde_json::json!({"body": "original", "from": "archivist"});
        let signed =
            sign_inbox_shape(&msg, "archivist", &key_id, &key_type, &alg, &private_pem).unwrap();

        let jws = signed["signature"].as_str().unwrap();
        let parts: Vec<&str> = jws.split('.').collect();

        // Tamper with the payload part
        let tampered_input = format!("{}.tampered", parts[0]);
        let signature_bytes = URL_SAFE_NO_PAD.decode(parts[2]).unwrap();

        let verifying_key = ed25519_dalek::VerifyingKey::from_public_key_pem(&public_pem).unwrap();
        let signature = ed25519_dalek::Signature::from_slice(&signature_bytes).unwrap();

        let result = verifying_key.verify_strict(tampered_input.as_bytes(), &signature);
        assert!(result.is_err(), "tampered message should NOT verify");
    }

    // -----------------------------------------------------------------------
    // resolve_identity_dir tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_resolve_identity_dir_archivist() {
        let root = Path::new("S:/Archivist-Agent");
        let dir = resolve_identity_dir(root, "archivist").unwrap();
        assert_eq!(dir, root.join(".identity"));
    }

    #[test]
    fn test_resolve_identity_dir_authority() {
        let root = Path::new("S:/Archivist-Agent");
        let dir = resolve_identity_dir(root, "authority").unwrap();
        assert_eq!(dir, root.join(".identity/authority"));
    }

    #[test]
    fn test_resolve_identity_dir_kernel() {
        let root = Path::new("S:/Archivist-Agent");
        let dir = resolve_identity_dir(root, "kernel").unwrap();
        assert_eq!(dir, root.join("../kernel-lane/.identity"));
    }

    #[test]
    fn test_resolve_identity_dir_unknown() {
        let root = Path::new("S:/Archivist-Agent");
        let result = resolve_identity_dir(root, "nonexistent");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("UNKNOWN_LANE"));
    }

    // -----------------------------------------------------------------------
    // Integration: full file-based signing with verification
    // -----------------------------------------------------------------------

    #[test]
    fn test_full_sign_and_verify_file() {
        with_temp_dir(|root| {
            let (_priv_pem, public_pem) = setup_signing_test_env(root);

            let msg = serde_json::json!({
                "schema_version": "1.4",
                "task_id": "integration-test",
                "from": "archivist",
                "to": "swarmmind",
                "type": "task",
                "priority": "P2",
                "subject": "Integration test",
                "body": "This is a test message for the signing pipeline."
            });
            let msg_path = root.join("integration_msg.json");
            create_json(&msg_path, &msg);

            // Sign
            let result = sign_message_file(&msg_path, Some("archivist"), false);
            assert_eq!(
                result.status, "ok",
                "integration signing: {}",
                result.message
            );

            // Read signed file
            let content = std::fs::read_to_string(&msg_path).unwrap();
            let signed: Value = serde_json::from_str(&content).unwrap();

            // Verify the JWS signature
            let jws = signed["signature"].as_str().unwrap();
            let parts: Vec<&str> = jws.split('.').collect();
            assert_eq!(parts.len(), 3);

            let signing_input = format!("{}.{}", parts[0], parts[1]);
            let sig_bytes = URL_SAFE_NO_PAD.decode(parts[2]).unwrap();

            let verifying_key =
                ed25519_dalek::VerifyingKey::from_public_key_pem(&public_pem).unwrap();
            let sig = ed25519_dalek::Signature::from_slice(&sig_bytes).unwrap();

            assert!(
                verifying_key
                    .verify_strict(signing_input.as_bytes(), &sig)
                    .is_ok(),
                "signed file should have valid signature"
            );

            // Verify metadata
            assert_eq!(signed["from"], "archivist");
            assert_eq!(signed["to"], "swarmmind");
            assert_eq!(signed["signature_alg"], "EdDSA");
            assert_eq!(signed["key_id"].as_str().unwrap().len(), 16);
        });
    }

    // -----------------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------------

    #[test]
    fn test_sign_message_bom_stripped() {
        with_temp_dir(|root| {
            let (_priv, _pub) = setup_signing_test_env(root);

            let msg_path = root.join("bom_msg.json");
            // Write JSON with BOM prefix
            let json = "\u{feff}{\"body\":\"test\",\"from\":\"archivist\"}";
            std::fs::write(&msg_path, json).unwrap();

            let result = sign_message_file(&msg_path, Some("archivist"), false);
            assert_eq!(result.status, "ok", "should handle BOM: {}", result.message);
        });
    }

    #[test]
    fn test_sign_message_empty_body() {
        with_temp_dir(|root| {
            let (_priv, _pub) = setup_signing_test_env(root);

            let msg = serde_json::json!({"from": "archivist", "body": ""});
            let msg_path = root.join("empty_body.json");
            create_json(&msg_path, &msg);

            let result = sign_message_file(&msg_path, Some("archivist"), false);
            assert_eq!(result.status, "ok", "should sign with empty body");
        });
    }

    #[test]
    fn test_sign_message_with_payload() {
        with_temp_dir(|root| {
            let (_priv, _pub) = setup_signing_test_env(root);

            let msg = serde_json::json!({
                "from": "archivist",
                "body": "with payload",
                "payload": {"mode": "inline", "compression": "none"}
            });
            let msg_path = root.join("with_payload.json");
            create_json(&msg_path, &msg);

            let result = sign_message_file(&msg_path, Some("archivist"), false);
            assert_eq!(result.status, "ok");
        });
    }

    #[test]
    fn test_sign_result_types() {
        // Verify SignResult struct works correctly
        let ok_result = SignResult::ok(
            "success",
            Some("abc123".to_string()),
            Some("sig.data".to_string()),
        );
        assert_eq!(ok_result.status, "ok");
        assert_eq!(ok_result.key_id.as_deref(), Some("abc123"));

        let err_result = SignResult::err("something went wrong");
        assert_eq!(err_result.status, "error");
        assert!(err_result.message.contains("wrong"));
        assert!(err_result.key_id.is_none());
    }

    #[test]
    fn test_key_id_is_hex() {
        let (_priv, pub_pem) = generate_ed25519_keypair();
        let key_id = derive_key_id_from_pem(&pub_pem).unwrap();
        // Verify it's valid hex
        assert_eq!(key_id.len(), 16);
        assert!(key_id.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
