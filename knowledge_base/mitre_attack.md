# MITRE ATT&CK Framework Knowledge Briefing

## Title: MITRE ATT&CK Enterprise TTP Matrix Summary
**Category**: Cyber Threat Intelligence / Threat Tactics
**Classification**: UNCLASSIFIED // STRA-INTEL

### Key Threat Tactics & Vectors

1. **Initial Access (TA0001)**
   - **T1190 - Exploit Public-Facing Application**: Adversaries leverage vulnerabilities in exposed network services, web servers, or VPN portals.
   - **T1566 - Phishing**: Spearphishing attachments, malicious links, and voice phishing (vishing) targeting defense contractors and infrastructure operators.
   - **T1078 - Valid Accounts**: Use of compromised credentials acquired through stealer logs or credential stuffing.

2. **Execution & Privilege Escalation (TA0002 / TA0004)**
   - **T1059 - Command and Scripting Interpreter**: PowerShell, Unix Shell, Windows Command Shell, and Python scripts executing obfuscated payloads.
   - **T1548 - Abuse Elevation Control Mechanism**: Sudo caching exploits, UAC bypasses, and token manipulation.

3. **Defense Evasion (TA0005)**
   - **T1027 - Obfuscated/Encrypted Files**: Payload packing, process hollowing, and living-off-the-land binaries (LOLBins) like `certutil` or `bitsadmin`.
   - **T1562 - Impair Defenses**: Disabling EDR agents, modifying Windows Defender registry keys, or tampering with audit logs.

4. **Persistence & Lateral Movement (TA0003 / TA0008)**
   - **T1053 - Scheduled Task/Job**: Cron jobs, systemd services, and Windows Task Scheduler entries.
   - **T1021 - Remote Services**: RDP, SSH, and SMB/PsExec lateral movement within segmented networks.

### Strategic Mitigation Protocols
- Enforce strict Multi-Factor Authentication (MFA) with FIDO2 hardware tokens on all external gateways.
- Deploy Endpoint Detection & Response (EDR) with real-time process monitoring and AMSI integration.
- Implement Least Privilege Access and Zero Trust Network Architecture (ZTNA) with micro-segmentation.
