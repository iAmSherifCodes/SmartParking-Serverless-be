const get30minsFromReservationAndCheckoutTime = (reservation, checkout) => {
    const reservationTime = new Date(reservation);
    const checkoutTime = new Date(checkout);
    const timeDifference = checkoutTime - reservationTime;
    console.log("Time dif", timeDifference)
    const numberOf30Mins = Math.floor(timeDifference / (30 * 60 * 1000));
    return numberOf30Mins;
  };

  console.log(get30minsFromReservationAndCheckoutTime('2024-12-01T10:00:00', '2024-12-02T10:00:00'));