# DNS, HTTP, HTTPS, and TLS

DNS translates domain names into records such as A (IPv4), AAAA (IPv6), CNAME (alias), and MX (mail exchange). A recursive resolver may answer from cache according to a record's time to live (TTL), or query authoritative DNS infrastructure when needed. DNS commonly uses UDP port 53, and TCP port 53 is also used in defined cases.

HTTP is an application-layer protocol for requests and responses. A request includes a method, target, headers, and sometimes a body. Common methods include GET, POST, PUT, PATCH, and DELETE. A response includes a status code, headers, and optionally a body. Status codes are grouped into informational (1xx), success (2xx), redirection (3xx), client error (4xx), and server error (5xx).

HTTPS is HTTP protected by TLS. TLS authenticates the server using certificates and negotiates cryptographic keys to protect confidentiality and integrity in transit. Do not describe HTTPS as a different HTTP method or claim that TLS alone guarantees a site is trustworthy.
