# Security

Please report security problems privately through GitHub's "Report a vulnerability" button on this repository, not in a public issue.

How ArrivalOps handles sensitive data:

- Ring tokens and AWS credentials are read on the server only and never sent to the browser. Keep them in `.env.local`, which is git-ignored.
- Camera frames are sent to Amazon Bedrock for a single yes/no vehicle check and are not written to disk by the server.
- The model is asked for a vehicle's colour and body type only. Licence plates and people are never requested, and any other output is discarded by schema validation.
