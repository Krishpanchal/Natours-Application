/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';

// data is a object which contains the fields
//If data contains password then type will be set to password

export const updateUserSettings = async (data, type) => {
  const url =
    type === 'password'
      ? '/api/v1/users/updateMyPassword'
      : '/api/v1/users/updateMe';

  try {
    const res = await axios({
      method: 'PATCH',
      url,
      data,
    });

    if (res.data.status === 'success') {
      showAlert('success', `${type.toUpperCase()} Updated Successfully`);
    }
  } catch (err) {
    showAlert('error', err.response.data.message);
  }
};
