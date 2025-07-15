const TIMEZONE = "Africa/Lagos";
const RATE_PER_30_MINS = 305.99;
const THIRTY_MINUTES_IN_MS = 30 * 60 * 1000;

const get30minsFromReservationAndCheckoutTime = (reservation, checkout) => {
  const reservationDateTime = new Date(reservation);
  const checkoutDateTime = new Date(checkout);
  const timeDifference = checkoutDateTime - reservationDateTime;
  if (timeDifference < 0) {
    return RATE_PER_30_MINS;
  } else if (timeDifference < THIRTY_MINUTES_IN_MS) {
    return RATE_PER_30_MINS;
  } else {
    const numberOf30Mins = Math.floor(timeDifference / THIRTY_MINUTES_IN_MS);
    return numberOf30Mins === 0 ? RATE_PER_30_MINS : numberOf30Mins * RATE_PER_30_MINS;
  }
  // const reservationTime = new Date(reservation);
  // const checkoutTime = new Date(checkout);
  // const timeDifference = checkoutTime - reservationTime;
  // console.log("Time dif", timeDifference);
  // // if the time difference is a negative value or is less than 30 return rate per 30 mins else multiply rate per 30 mins by time difference
  // if (timeDifference < 0) {
  //   return RATE_PER_30_MINS;
  // } else if (timeDifference < THIRTY_MINUTES_IN_MS) {
  //   return RATE_PER_30_MINS;
  // } else {
  //   const numberOf30Mins = Math.floor(timeDifference / THIRTY_MINUTES_IN_MS);
  //   return numberOf30Mins === 0 ? RATE_PER_30_MINS : numberOf30Mins * RATE_PER_30_MINS;
  // }


  // const numberOf30Mins = Math.floor(timeDifference / THIRTY_MINUTES_IN_MS);
  // return numberOf30Mins === 0 ? RATE_PER_30_MINS : numberOf30Mins * RATE_PER_30_MINS;
    // const reservationTime = new Date(reservation);
    // const checkoutTime = new Date(checkout);
    // const timeDifference = checkoutTime - reservationTime;
    // console.log("Time dif", timeDifference)
    // const numberOf30Mins = Math.floor(timeDifference / (30 * 60 * 1000));
    // return numberOf30Mins;
  };

  console.log(get30minsFromReservationAndCheckoutTime('2025-02-03T10:00:00', '2025-02-03T15:00:00'));


