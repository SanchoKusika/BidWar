import { assertEquals } from 'jsr:@std/assert@1';
import { isBlockedIp } from './og.ts';

Deno.test('private and loopback IPv4 are blocked', () => {
  for (const ip of [
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '0.0.0.0',
  ]) {
    assertEquals(isBlockedIp(ip), true, ip);
  }
});

Deno.test('shared address space and benchmarking ranges are blocked', () => {
  for (const ip of ['100.64.0.1', '100.127.255.254', '198.18.0.1', '198.19.255.255']) {
    assertEquals(isBlockedIp(ip), true, ip);
  }
});

Deno.test('the edges of those ranges stay public', () => {
  for (const ip of ['100.63.255.255', '100.128.0.1', '198.17.0.1', '198.20.0.1', '8.8.8.8']) {
    assertEquals(isBlockedIp(ip), false, ip);
  }
});

Deno.test('IPv6 loopback, link-local, ULA, mapped and NAT64 are blocked', () => {
  for (const ip of ['::1', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1', '64:ff9b::a00:1']) {
    assertEquals(isBlockedIp(ip), true, ip);
  }
});

Deno.test('public IPv6 stays public', () => {
  assertEquals(isBlockedIp('2a00:1450:4001:80b::200e'), false);
});
