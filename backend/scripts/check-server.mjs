const res = await fetch('http://localhost:4000/api/v1/health').catch(() => null);
if (res && res.ok) {
  const data = await res.json();
  console.log('Server running:', JSON.stringify(data.data));
} else {
  console.log('Server stopped or unreachable');
}
