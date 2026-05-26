"""Diagnostic script for Archivist Agent UI.
Runs a tiny HTTP server to serve the static UI files and then checks the layout
at both the default (1200×800) and the user's small viewport (553×369).
"""

import os
import time
import threading
import socketserver
from http.server import SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
UI_DIR = "S:/Archivist-Agent/ui"
SERVER_PORT = 9876
SCREENSHOT_PATH = "S:/Archivist-Agent/test-screenshot.png"


# ------------------------------------------------------------------
# Simple HTTP server to serve UI files (quiet logging)
# ------------------------------------------------------------------
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress default console output


def start_http_server():
    os.chdir(UI_DIR)
    handler = QuietHandler
    httpd = socketserver.TCPServer(("127.0.0.1", SERVER_PORT), handler)
    # Store reference for later shutdown
    return httpd


# ------------------------------------------------------------------
# Helper to inspect elements
# ------------------------------------------------------------------
def check_page(page, label: str):
    print(f"\n{'=' * 60}\n  {label}\n{'=' * 60}")
    selectors = {
        "#app": "#app",
        "header": "header",
        "footer": "footer",
        "#sidebar": "#sidebar",
        "#center-panel": "#center-panel",
        "#chat-panel": "#chat-panel",
        "#chat-messages": "#chat-messages",
        "#chat-input": "#chat-input",
        "#lane-list": "#lane-list",
        "#evidence-panel": "#evidence-panel",
        ".chat-layout": ".chat-layout",
        ".chat-input-area": ".chat-input-area",
    }
    for name, sel in selectors.items():
        el = page.query_selector(sel)
        if not el:
            print(f"  NOT FOUND: {name}")
            continue
        visible = el.is_visible()
        status = "VIS" if visible else "HID"
        disp = el.evaluate("e => getComputedStyle(e).display")
        w = el.evaluate("e => getComputedStyle(e).width")
        h = el.evaluate("e => getComputedStyle(e).height")
        box = el.bounding_box()
        print(f"  {status} {name}: disp={disp} w={w} h={h} box={box}")

    # Grid info for main
    main = page.query_selector("main")
    if main:
        cols = main.evaluate("e => getComputedStyle(e).gridTemplateColumns")
        rows = main.evaluate("e => getComputedStyle(e).gridTemplateRows")
        print(f"  main grid: columns={cols} rows={rows}")
        # Header + main + footer height sum
        header_h = page.query_selector("header").evaluate("e => e.offsetHeight")
        main_h = main.evaluate("e => e.offsetHeight")
        footer_h = page.query_selector("footer").evaluate("e => e.offsetHeight")
        viewport_h = page.viewport_size["height"]
        print(
            f"  heights: header={header_h}px, main={main_h}px, footer={footer_h}px => total={header_h + main_h + footer_h}px (viewport={viewport_h}px)"
        )

    # Chat layout flex direction
    cl = page.query_selector(".chat-layout")
    if cl:
        fd = cl.evaluate("e => getComputedStyle(e).flexDirection")
        print(f"  .chat-layout flex-direction: {fd}")

    # Check for JS errors (collect console errors)
    errors = []

    def on_msg(msg):
        if msg.type == "error":
            errors.append(msg.text)

    page.on("console", on_msg)
    page.wait_for_timeout(500)
    if errors:
        print(f"  JS ERRORS: {errors}")
    else:
        print("  No JS errors detected")


# ------------------------------------------------------------------
# Main execution
# ------------------------------------------------------------------
if __name__ == "__main__":
    # Start HTTP server in a background thread
    httpd = start_http_server()
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(1)  # give server a moment to start

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # 1200×800 viewport
        page = browser.new_page(viewport={"width": 1200, "height": 800})
        page.goto(f"http://127.0.0.1:{SERVER_PORT}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        page.screenshot(path=SCREENSHOT_PATH)
        print(f"Screenshot saved to {SCREENSHOT_PATH}")
        check_page(page, "1200 × 800")

        # 553×369 viewport (user's size)
        # 720×?? viewport (additional breakpoint)
        page.set_viewport_size({"width": 720, "height": 800})
        page.wait_for_timeout(1500)
        check_page(page, "720 × 800 (breakpoint)")
        # 1080×?? viewport (additional breakpoint)
        page.set_viewport_size({"width": 1080, "height": 800})
        page.wait_for_timeout(1500)
        check_page(page, "1080 × 800 (breakpoint)")
        page.set_viewport_size({"width": 553, "height": 369})
        page.wait_for_timeout(1500)  # allow media queries to apply
        check_page(page, "553 × 369 (user)")

        browser.close()

    # Shut down HTTP server
    httpd.shutdown()
    server_thread.join()
    print("\nDone.")
