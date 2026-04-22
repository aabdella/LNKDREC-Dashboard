import socket, json

def test_daemon():
    SOCK = "/tmp/bu-default.sock"
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.connect(SOCK)
        # Get session ID
        s.sendall(json.dumps({"meta": "session"}).encode() + b"\n")
        resp = s.recv(1024)
        print(f"Daemon Response: {resp.decode()}")
        s.close()
    except Exception as e:
        print(f"Error: {e}")

test_daemon()
