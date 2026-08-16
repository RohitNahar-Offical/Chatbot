# OSINT Collection & Verification Methodology

## Title: Open Source Intelligence (OSINT) Tactical Workflow
**Category**: Intelligence Collection & Reconnaissance
**Classification**: UNCLASSIFIED // STRA-INTEL

### OSINT Intelligence Cycle

1. **Planning & Direction**
   - Define exact Intelligence Requirements (PIRs).
   - Establish operational security (OPSEC) posture: dedicated sock puppets, VPN/Tor routing, isolated browser environments (whonix/Tails), and sanitized metadata.

2. **Collection & Footprinting**
   - **Domain & Infrastructure Recon**: WHOIS historical lookup, DNS enumeration (subdomain brute-forcing, passive DNS), SSL/TLS certificate transparency logs (crt.sh).
   - **Geospatial Intelligence (GEOINT)**: Satellite imagery analysis, sun elevation estimation, terrain shadowing matching, street view cross-referencing.
   - **Social & Digital Footprint**: Username correlation across forums, code repository commit leaks (GitHub secret scanning), PGP key search servers.

3. **Verification & Fact Checking Matrix**
   - **Source Reliability Grade**:
     - A: Reliable / Authenticated source
     - B: Usually Reliable
     - C: Fairly Reliable
     - D: Unreliable
   - **Information Authenticity Grade**:
     - 1: Confirmed by independent sensors/sources
     - 2: Probably True
     - 3: Possibly True
     - 4: Doubtful / Unverified

4. **Analysis & Synthesis**
   - Cross-examine multiple disassociated data streams before synthesizing final intelligence briefings.
