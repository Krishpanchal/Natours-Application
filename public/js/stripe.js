/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';

export const bookTour = async (tourId) => {
  const stripe = Stripe(
    'pk_test_51HUTmpCFytkhuibCQh2Trlt81GwGxZMDGUqnymNfNjSn2baOQV27Fa6i03tUXI1hb6YbUpX0nfJEmjIMoQxAjkxU00PqLrX2DC'
  );

  try {
    // 1) Get checkout session from API
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);

    // 2) Create checkout form
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    showAlert('error', err);
  }
};
