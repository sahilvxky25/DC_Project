# OSI and TCP/IP models

The OSI reference model has seven layers: Physical (bits and signals), Data Link (frames and local delivery), Network (logical addressing and routing), Transport (end-to-end delivery using TCP or UDP), Session (dialogue management), Presentation (data representation and encryption concepts), and Application (network services used by applications).

The TCP/IP model is commonly described with four layers: Link, Internet, Transport, and Application. Roughly, OSI Physical and Data Link map to TCP/IP Link; OSI Network maps to Internet; OSI Transport maps to Transport; and OSI Session, Presentation, and Application map to TCP/IP Application.

Encapsulation adds protocol information as data moves down the stack at the sender. Decapsulation removes and interprets it at the receiver. Typical data units are bits, frames, packets, segments/datagrams, and application data. The exact terminology can vary by protocol and teaching convention.
