# CISA Cyber Security Advisories & Vulnerability Guidelines

## Title: CISA Known Exploited Vulnerabilities (KEV) & Incident Response Protocols
**Category**: Cyber Defense & Infrastructure Protection
**Classification**: UNCLASSIFIED // STRA-INTEL

### Priority Vulnerability Vectors & Threat Advisories

1. **Critical Remote Code Execution (RCE) Handling**
   - **Protocol**: Any vulnerability assigned a CVSS score ≥ 9.0 listed on the CISA KEV catalog requires emergency patch deployment within 14 days for federal and critical infrastructure assets.
   - **Immediate Containment**: Isolate affected hosts from enterprise subnets, revoke associated session tokens, and preserve forensic memory dumps before rebooting.

2. **Ransomware Prevention & Recovery Framework (AA23-347A)**
   - **Vector Defense**: Ransomware actors heavily exploit unpatched Edge devices (SSL-VPNs, firewalls) and exposed RDP ports.
   - **Immutable Backups**: Maintain air-gapped, encrypted, offline backups with verified 3-2-1 storage topology.
   - **Active Monitoring**: Inspect Active Directory domain controller event logs for unauthorized NTDS.dit extraction or unexpected Kerberoasting activity.

3. **Zero Trust Architecture Directive (M-22-09 Summary)**
   - Enforce explicit identity verification for every resource access request.
   - Micro-segment internal assets to contain blast radius in breach scenarios.
   - Encrypt all internal DNS (DoH/DoT) and web traffic (TLS 1.3 minimum).
