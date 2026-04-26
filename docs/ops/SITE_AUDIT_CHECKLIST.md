# Site Audit Evidence Pack — deliberateensemble.works

**Purpose:** Verify the site is live, functional, and serving real content  
**Status:** [ ] INCOMPLETE / [ ] COMPLETE WITH EVIDENCE  
**Audit date:** [DATE]  
**Auditor:** [lane/operator]

---

## Availability Check

| Check | Result | Evidence |
|-------|--------|----------|
| Site loads at deliberateensemble.works | [ ] pass / [ ] fail | screenshot: |
| HTTPS valid | [ ] pass / [ ] fail | cert screenshot: |
| Load time acceptable (<3s) | [ ] pass / [ ] fail | timing: |
| No 5xx errors on homepage | [ ] pass / [ ] fail | |
| Mobile responsive | [ ] pass / [ ] fail | screenshot: |

---

## Content Verification

### Document Count
| Section/Category | Expected | Actual | Match |
|-----------------|----------|--------|-------|
| Total documents | | | |
| [Category 1] | | | |
| [Category 2] | | | |
| [Category 3] | | | |

**Evidence:** [screenshot path or URL of count display]

### Taxonomy Check
| Check | Result | Notes |
|-------|--------|-------|
| Tags present and functional | [ ] yes / [ ] no | |
| Categories load correctly | [ ] yes / [ ] no | |
| Tag filtering works | [ ] yes / [ ] no | |
| Category filtering works | [ ] yes / [ ] no | |

### Search Verification
| Test Query | Expected Result | Actual Result | Pass |
|-----------|----------------|---------------|------|
| [known document title] | find document | | [ ] |
| [known tag] | find tagged docs | | [ ] |
| [known category] | find category docs | | [ ] |
| [empty query] | graceful handling | | [ ] |
| [nonsense query] | no crash, empty result | | [ ] |

**Search index status:** [ ] functional / [ ] degraded / [ ] broken  
**Evidence:** [screenshot of search working]

---

## Architecture Representation

| Check | Result | Notes |
|-------|--------|-------|
| 4-lane system described accurately | [ ] yes / [ ] no / [ ] partial | |
| Lane roles correct | [ ] yes / [ ] no / [ ] partial | |
| No outdated/contradicted info | [ ] yes / [ ] issues found | |

**Issues found:**
- 

---

## Accessibility Review

| Check | Result | Notes |
|-------|--------|-------|
| Text contrast sufficient (WCAG AA) | [ ] pass / [ ] fail | |
| Images have alt text | [ ] pass / [ ] fail / [ ] N/A | |
| Navigation keyboard accessible | [ ] pass / [ ] fail | |
| Font size readable at default zoom | [ ] pass / [ ] fail | |
| Low-vision mode / high contrast | [ ] available / [ ] not available | |
| Screen reader basic compatibility | [ ] pass / [ ] fail / [ ] untested | |

**Accessibility priority items:**
1. 
2. 

---

## Evidence Pack Contents

All evidence committed to: `docs/ops/evidence/site-audit-[DATE]/`

| File | Description | Present |
|------|-------------|---------|
| `homepage-screenshot.png` | Site loading | [ ] |
| `document-count-screenshot.png` | Actual count visible | [ ] |
| `search-working-screenshot.png` | Search returning results | [ ] |
| `taxonomy-screenshot.png` | Tags/categories visible | [ ] |
| `accessibility-notes.txt` | Issues and pass/fail | [ ] |
| `audit-summary.json` | Machine-readable summary | [ ] |

### `audit-summary.json` structure
```json
{
  "audit_date": "",
  "auditor": "",
  "site_url": "https://deliberateensemble.works",
  "availability": "pass|fail",
  "document_count": 0,
  "search_functional": true,
  "taxonomy_functional": true,
  "accessibility_grade": "pass|partial|fail",
  "open_issues": [],
  "evidence_path": "docs/ops/evidence/site-audit-[DATE]/"
}
```

---

## Audit Sign-off

**Overall site status:** [ ] HEALTHY / [ ] DEGRADED / [ ] BROKEN  
**Audited by:**  
**Date:**  
**Next audit scheduled:**  

**Open issues requiring follow-up:**
1. 
2. 
