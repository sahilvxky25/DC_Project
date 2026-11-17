# Application Layer: DNS, HTTP, HTTPS, and TLS

## DNS

The Domain Name System maps names to resource records. A resolver may query a recursive DNS service, which can consult authoritative DNS servers and cache results according to record TTLs.

Common record types:

- **A:** maps a name to an IPv4 address.
- **AAAA:** maps a name to an IPv6 address.
- **CNAME:** aliases one name to another canonical name.
- **MX:** identifies mail exchangers.
- **NS:** identifies authoritative name servers.
- **TXT:** carries text data used for several purposes, including domain verification and email policy.

A cached answer can avoid a new lookup until its TTL expires. Negative responses may also be cached according to DNS rules. DNS commonly uses UDP port 53 for ordinary queries, but TCP is also used, including for some large responses and zone transfers. DNS over TLS and DNS over HTTPS provide encrypted DNS transports.

## HTTP

HTTP is an application protocol for request/response communication. A request includes a method, target, headers, and sometimes a body. A response includes a status code, headers, and optionally a body.

Common methods:

- **GET:** retrieve a representation.
- **HEAD:** retrieve response metadata without the response content.
- **POST:** submit data for processing or resource creation.
- **PUT:** create or replace the state of a target resource; defined as idempotent.
- **PATCH:** apply a partial modification.
- **DELETE:** request removal of a target resource; defined as idempotent.

Idempotence means repeating the same request has the same intended effect as making it once; it does not necessarily mean identical response bytes.

## HTTP status-code classes

- **1xx:** informational.
- **2xx:** successful.
- **3xx:** redirection.
- **4xx:** client error.
- **5xx:** server error.

Examples: 200 OK, 201 Created, 204 No Content, 301 Moved Permanently, 302 Found, 304 Not Modified, 400 Bad Request, 401 Unauthorized (authentication required or failed), 403 Forbidden, 404 Not Found, 405 Method Not Allowed, 409 Conflict, 429 Too Many Requests, 500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, and 504 Gateway Timeout.

## HTTPS and TLS

HTTPS is HTTP protected by TLS. TLS provides confidentiality, integrity, and server authentication when correctly configured and validated. A simplified TLS 1.3 handshake negotiates parameters, authenticates the server using a certificate, establishes shared traffic keys, and then protects application data. Actual handshakes may vary due to resumption, extensions, client authentication, and other features.

Encryption does not make an application automatically safe: authorization, input validation, secure session handling, and correct certificate validation still matter.

## BitSecure modules

The Application layer group contains DNS and HTTP/TLS learning experiences. The labs visualize protocol concepts and request/response structures; they are not a general-purpose browser, public DNS resolver, or real TLS interception tool.
