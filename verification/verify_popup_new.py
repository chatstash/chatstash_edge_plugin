
from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the popup.html directly
        cwd = os.getcwd()
        popup_path = os.path.join(cwd, 'extension', 'popup.html')
        page.goto(f'file://{popup_path}')

        # Take a screenshot
        page.screenshot(path='verification/popup_ui_new.png')

        browser.close()

if __name__ == '__main__':
    run()
