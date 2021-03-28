/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';

export async function loginUser(email, password) {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/login',
      data: {
        email,
        password,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Logged in successfully');
      location.assign('/');
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
}

export async function logoutUser() {
  try {
    const res = await axios({
      method: 'GET',
      url: '/api/v1/users/logout',
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Logged out successfully');
      location.reload(true);
    }
  } catch (err) {
    showAlert('error', 'Error logging out! Try again');
  }
}
