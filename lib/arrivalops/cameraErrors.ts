/** Ring and WebRTC errors, in words someone at a counter can act on. */
export function friendlyCameraError(message: string): string {
  if (/401|403|expired|unauthori[sz]ed|invalid.?token/i.test(message)) {
    return 'The Ring token has expired. Playground tokens last 30 minutes: generate a new one, put it in .env.local and restart.'
  }
  if (/no ring devices/i.test(message))
    return 'No Ring cameras on this account. In the Developer Playground, start the Vehicle simulation first.'
  if (/fetch|network/i.test(message)) return 'Can’t reach Ring right now. Check the connection and try again.'
  return message
}

/** Bedrock errors, in words that say whose problem it is. */
export function friendlyVisionError(message: string): string {
  if (/operation not allowed|access ?denied|not authori[sz]ed|don't have access/i.test(message))
    return 'Amazon Bedrock is not enabled for this AWS account ("' + message + '").'
  if (/throttl|too many requests/i.test(message)) return 'Amazon Bedrock is busy; frames will be retried.'
  if (/credential|security token/i.test(message)) return 'AWS credentials are missing or expired.'
  return message
}
