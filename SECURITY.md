# Security policy

## Reporting vulnerabilities

Please report suspected vulnerabilities privately to `dev@devplus.fun` rather than opening a public issue. Include affected version, reproduction steps, impact and any mitigation. Do not include real location or personal data in reports. Maintainer response and support timelines are not guaranteed.

## Deployment warning

The current application has no user authentication or room authorization. Room names are not secrets or access controls; the signed anonymous cookie is not an identity. Do not expose sensitive locations on a public deployment. See [AUDIT.md](AUDIT.md) for known blockers and [README.md](README.md) for HTTPS and proxy configuration. SOS is not a substitute for emergency services. Older release support is not guaranteed; verify security fixes against the branch you deploy.
