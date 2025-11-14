const brevo = require('@getbrevo/brevo');

let apiInstance = null;

/**
 * Initialize Brevo API client
 */
const initBrevoClient = () => {
  if (apiInstance) {
    return apiInstance;
  }

  // Create API instance with API key
  apiInstance = new brevo.TransactionalEmailsApi();

  // Set API key
  apiInstance.setApiKey(
    brevo.TransactionalEmailsApiApiKeys.apiKey,
    process.env.BREVO_API_KEY
  );

  return apiInstance;
};

/**
 * Get Brevo API instance
 */
const getBrevoClient = () => {
  if (!apiInstance) {
    return initBrevoClient();
  }
  return apiInstance;
};

module.exports = {
  initBrevoClient,
  getBrevoClient,
};
