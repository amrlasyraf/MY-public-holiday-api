# Public release checklist

Complete this before connecting or pushing to a public GitHub repository.

- [ ] Review every file staged by `git status`.
- [ ] Search the full history and working tree for credentials and personal information.
- [ ] Confirm `.env`, `.dev.vars`, private keys and `private/` are ignored.
- [ ] Confirm source documents are linked rather than copied into the repository.
- [ ] Enable GitHub secret scanning and push protection where available.
- [ ] Enable private vulnerability reporting.
- [ ] Configure branch protection to require the CI workflow.
- [ ] Use GitHub repository secrets for deployment credentials.
- [ ] Add a private security contact before inviting external contributors.
- [ ] Verify the API response contains no internal review notes or private notification identifiers.
