const { io } = require("socket.io-client");
const socket = io("http://localhost:3000");

let step = 0;

socket.on("connect", () => {
  console.log("Connected.");
  socket.emit("reset_auction");
});

socket.on("auction_update", (state) => {
  if (state.status === "IDLE" && step === 0) {
    step = 1;
    console.log("Starting auction for a Salassuolo player...");
    socket.emit("start_auction", {
      player: {
        name: "TestPlayer",
        role: "A",
        quot: 10,
        currentOwner: "Salassuolo" // This triggers BIVIO if someone bids
      }
    });
  } else if (state.status === "ACTIVE" && step === 1) {
    step = 2;
    console.log("Bidding by Worme...");
    socket.emit("place_bid", { teamName: "Worme", amount: 5 });
  } else if (state.status === "ACTIVE" && state.currentBidder === "Worme" && step === 2) {
    step = 3;
    console.log("Fast-forwarding to BIVIO...");
    // Wait for the timer to expire or we can't easily fast forward... 
    // Wait, let's just let the timer expire. It's 15 seconds.
  } else if (state.status === "BIVIO" && step === 3) {
    step = 4;
    console.log("In BIVIO! Emitting PROTEGGI...");
    socket.emit("bivio_decision", { option: "PROTEGGI" });
  } else if (state.status === "ASSIGNED" && step === 4) {
    step = 5;
    console.log("Auction assigned! Last decision:", state.lastDecision);
    console.log("Assigned to team:", state.currentPlayer.currentOwner, "or bidder:", state.currentBidder);
    process.exit(0);
  }
});
