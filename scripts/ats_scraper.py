import socket, json, time, re

def browser_cmd(method, params=None):
    SOCK = "/tmp/bu-default.sock"
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.connect(SOCK)
    s.sendall(json.dumps({"method": method, "params": params or {}}).encode() + b"\n")
    resp = s.recv(1024 * 1024)
    s.close()
    return json.loads(resp.decode())

def scrape_jobs(url):
    print(f"🌐 Navigating to {url}...")
    browser_cmd("Page.navigate", {"url": url})
    time.sleep(5) # Allow JS rendering
    
    # Extract jobs using a generic JS script that looks for common job board patterns
    js_script = """
    (() => {
        const jobs = [];
        // Look for links that look like job posts or items in lists
        const selectors = [
            'a[href*="/jobs/"]', 'a[href*="/job/"]', 'a[href*="/posting/"]',
            '.ashby-job-posting', '.job-post', '.posting-title', 'h2', 'h3'
        ];
        
        document.querySelectorAll(selectors.join(',')).forEach(el => {
            const text = el.innerText.trim();
            const href = el.href || '';
            
            // Heuristic: Job titles are usually 10-60 chars and contain keywords
            if (text.length > 5 && text.length < 100 && /Engineer|Developer|Manager|Analyst|Designer|Sales|Marketing|Lead|Director/i.test(text)) {
                jobs.append({title: text, url: href});
            }
        });
        return jobs;
    })()
    """
    
    # Simple extraction for now: Title and URL from <a> tags
    res = browser_cmd("Runtime.evaluate", {"expression": "Array.from(document.querySelectorAll('a')).map(a => ({title: a.innerText, url: a.href}))"})
    
    raw_links = []
    if "result" in res and "result" in res["result"]:
        raw_links = res["result"]["result"]["value"]
    
    filtered_jobs = []
    seen = set()
    
    keywords = ["Engineer", "Developer", "Manager", "Analyst", "Designer", "Sales", "Lead", "Director", "Software", "Product"]
    
    for link in raw_links:
        title = (link.get('title') or '').strip().replace('\n', ' ')
        url = link.get('url') or ''
        
        if not title or not url or len(title) < 5 or len(title) > 80:
            continue
            
        if any(kw.lower() in title.lower() for kw in keywords):
            if title not in seen:
                filtered_jobs.append({"title": title, "url": url})
                seen.add(title)
                
    return filtered_jobs

# Test with Omnea
jobs = scrape_jobs("https://jobs.ashbyhq.com/omnea/")
print(f"✅ Found {len(jobs)} jobs.")
for j in jobs[:5]:
    print(f" - {j['title']} ({j['url']})")
