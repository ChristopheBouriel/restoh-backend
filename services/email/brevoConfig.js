const brevo = require('@getbrevo/brevo');

let apiInstance = null;

/**
 * Initialize Brevo API client
 */
const initBrevoClient = () => {
  if (apiInstance) {
    return apiInstance;
  }

  const apiKey = brevo.ApiClient.instance.authentications['api-key'];
  apiKey.apiKey = process.env.BREVO_API_KEY;

  apiInstance = new brevo.TransactionalEmailsApi();

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
