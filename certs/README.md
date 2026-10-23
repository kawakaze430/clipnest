# Database trust bundle

`rds-global-bundle.pem` is the public AWS RDS certificate bundle downloaded from https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem on 22 October 2026. It contains public CA certificates, not client credentials. Production uses Node TLS with certificate/hostname verification enabled. Review AWS RDS CA rotation announcements and rebuild the image when the supported trust bundle changes; do not disable verification.
