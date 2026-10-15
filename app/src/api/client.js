import axios from 'axios';
import Constants from 'expo-constants';

// Use app.json "extra.apiUrl" if set, otherwise the IP of the computer running `expo start`.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const API_URL = Constants.expoConfig?.extra?.apiUrl || `http://${devHost || 'localhost'}:4000`;

const client = axios.create({ baseURL: `${API_URL}/api`, timeout: 90000 });

let authToken = null;
let onUnauthorized = null;

export const setAuthToken = (token) => {
  authToken = token;
};
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

client.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && authToken && onUnauthorized) onUnauthorized();
    return Promise.reject(err);
  }
);

export const errorMessage = (err) =>
  err.response?.data?.message ||
  (err.code === 'ECONNABORTED' ? 'Server took too long, please try again' : null) ||
  (err.request && !err.response ? `Cannot reach server at ${API_URL}` : null) ||
  err.message ||
  'Something went wrong';

// Cloudinary images are full URLs; local-disk images are served by the backend.
export const imageUrl = (path) => (/^https?:\/\//.test(path) ? path : `${API_URL}${path}`);

export default client;
