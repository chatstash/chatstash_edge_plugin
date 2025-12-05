from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the local HTML file
        # We need absolute path for file://
        cwd = os.getcwd()
        filepath = f"file://{cwd}/extension/popup.html"

        page.goto(filepath)

        # Click settings to reveal the panel
        page.click('#toggleSettings')

        # Wait for display change
        page.wait_for_timeout(500)

        # Take screenshot of the popup
        page.screenshot(path="popup_ui_settings.png")

        browser.close()

if __name__ == "__main__":
    run()
