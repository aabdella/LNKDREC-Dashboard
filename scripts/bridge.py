import socket, json, time, sys

def cmd(m, p=None):
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.connect("/tmp/bu-default.sock")
        s.sendall(json.dumps({"method": m, "params": p or {}}).encode() + b"\n")
        r = s.recv(1024 * 1024)
        s.close()
        return json.loads(r.decode())
    except Exception as e:
        return {"error": str(e)}

url = sys.argv[1]
cmd("Page.navigate", {"url": url})
time.sleep(8)

js_extract = """
(() => {
    const results = [];
    const keywords = /Engineer|Developer|Manager|Analyst|Designer|Sales|Marketing|Lead|Director|Software|Product|Fullstack|Frontend|Backend|DevOps/i;
    
    document.querySelectorAll('a, h1, h2, h3, h4, [role="link"], button').forEach(el => {
        const text = el.innerText.trim().replace(/\\n/g, ' ');
        if (text.length > 5 && text.length < 100 && keywords.test(text)) {
            let url = el.href;
            if (!url && el.closest('a')) url = el.closest('a').href;
            if (!url && el.getAttribute('data-href')) url = el.getAttribute('data-href');
            
            results.push({title: text, url: url || window.location.href});
        }
    });
    return results;
})()
"""

res = cmd("Runtime.evaluate", {"expression": js_extract, "returnByValue": True})
print(json.dumps(res))
