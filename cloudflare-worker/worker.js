addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const apiUrl = 'https://your-python-backend-url.com/api'; // Replace with your Python backend URL

    if (request.method === 'GET') {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { 'Content-Type': 'application/json' }
        });
    } else if (request.method === 'POST') {
        const requestBody = await request.json();
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        return new Response(await response.text(), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response('Method Not Allowed', { status: 405 });
}

// HTML Frontend
const html = `<!DOCTYPE html>\n<html>\n<head>\n    <title>Cloudflare Worker Proxy</title>\n</head>\n<body>\n    <h1>API Proxy</h1>\n    <form id='api-form'>\n        <input type='text' name='query' placeholder='Your query here' />\n        <button type='submit'>Submit</button>\n    </form>\n    <pre id='response'></pre>\n    <script>\n        document.getElementById('api-form').onsubmit = async (e) => {\n            e.preventDefault();\n            const formData = new FormData(e.target);\n            const query = formData.get('query');\n            const response = await fetch('/api', {\n                method: 'POST',\n                headers: { 'Content-Type': 'application/json' },\n                body: JSON.stringify({ query })\n            });\n            const data = await response.json();\n            document.getElementById('response').textContent = JSON.stringify(data, null, 2);\n        };\n    <\/script>\n</body>\n</html>`;

addEventListener('fetch', event => {
    event.respondWith(new Response(html, {
        headers: { 'Content-Type': 'text/html' }
    }));
});
