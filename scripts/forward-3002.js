const net = require('net');

const TARGET_PORT = 3000;
const LISTEN_PORT = 3002;

function createForwarder(host) {
  const server = net.createServer((socket) => {
    const client = net.createConnection({ port: TARGET_PORT, host: '127.0.0.1' }, () => {
      socket.pipe(client);
      client.pipe(socket);
    });
    socket.on('error', () => client.destroy());
    client.on('error', () => socket.destroy());
  });

  server.on('error', (err) => {
    console.error(`Forwarder error on ${host || 'all'}:`, err.message);
  });

  return server;
}

// Lắng nghe trên cả IPv4 và IPv6 để trình duyệt gõ localhost:3002 hoặc 127.0.0.1:3002 đều vào được 100%
const serverIpv4 = createForwarder('127.0.0.1');
serverIpv4.listen(LISTEN_PORT, '127.0.0.1', () => {
  console.log(`TCP Forwarder listening on 127.0.0.1:${LISTEN_PORT} -> 127.0.0.1:${TARGET_PORT}`);
});

const serverIpv6 = createForwarder('::1');
serverIpv6.listen(LISTEN_PORT, '::1', () => {
  console.log(`TCP Forwarder listening on [::1]:${LISTEN_PORT} -> 127.0.0.1:${TARGET_PORT}`);
});
