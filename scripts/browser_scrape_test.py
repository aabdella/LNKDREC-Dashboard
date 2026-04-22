import socket, json, time

def browser_cmd(method, params=None):
    SOCK = "/tmp/bu-default.sock"
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.connect(SOCK)
    s.sendall(json.dumps({"method": method, "params": params or {}}).encode() + b"\n")
    resp = s.recv(1024 * 1024) # 1MB buffer for HTML
    s.close()
    return json.loads(resp.decode())

def scrape_omnea():
    print("🌐 Navigating to Omnea Careers...")
    browser_cmd("Page.navigate", {"url": "https://jobs.ashbyhq.com/omnea/"})
    
    print("⏳ Waiting for load...")
    time.sleep(5) # Give it time to render JS
    
    print("📄 Extracting page content...")
    res = browser_cmd("Runtime.evaluate", {"expression": "document.body.innerText"})
    
    if "result" in res and "result" in res["result"]:
        content = res["result"]["result"]["value"]
        print(f"✅ Content Extracted! Length: {len(content)}")
        print("-" * 30)
        print(content[:500] + "...")
        print("-" * 30)
    else:
        print(f"❌ Failed: {res}")

scrape_omnea()
