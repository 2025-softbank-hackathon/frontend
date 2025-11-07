import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE,
});

export default api;

export const joinApi = () =>
  api.get('/api/join').then((response) => response.data);

export const historyApi = () =>
  api.get('/api/messages').then((response) => response.data);

