const userVideo = document.querySelector(".user-video video");
const remoteVideo = document.querySelector(".remote-video video");

let peer;
let remoteId;

const socket = io();

socket.on("ada user lain", async (joinedUsers) => {
    remoteId = joinedUsers.find((userId) => userId !== socket.id);
    if (remoteId) await createPeerConnection();
});

socket.on("offer", async ({ offer, from }) => {
    remoteId = from;
    if (!peer) await createPeerConnection();
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(new RTCSessionDescription(answer));
    socket.emit("answer", { answer, to: remoteId, from: socket.id });
});

socket.on("ice candidate", async (iceCandidate) => {
    if (peer) {
        try {
            const candidate = new RTCIceCandidate(iceCandidate);
            await peer.addIceCandidate(candidate);
        } catch (error) {
            console.warn("Failed to add ICE candidate", error);
        }
    }
});

socket.on("answer", async ({ answer }) => {
    if (peer) {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
    }
});

async function createPeerConnection() {
    peer = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.stunprotocol.org" },
            {
                urls: "turn:numb.viagenie.ca",
                username: "webrtc@live.com",
                credential: "muazkh",
            },
        ],
    });

    const userStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
    });
    userVideo.muted = true;
    userVideo.srcObject = userStream;
    userVideo.onloadmetadata = () => {
        userVideo.play();
    };

    userStream.getTracks().forEach((track) => peer.addTrack(track, userStream));

    peer.onicecandidate = handleIceCandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = handleNegotiationNeededEvent;
}

async function handleNegotiationNeededEvent() {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(new RTCSessionDescription(offer));
    socket.emit("offer", { offer, to: remoteId, from: socket.id });
}

function handleTrackEvent(e) {
    const [stream] = e.streams;
    remoteVideo.srcObject = stream;
    remoteVideo.onloadmetadata = () => {
        remoteVideo.play();
    };
}

function handleIceCandidateEvent(e) {
    if (e.candidate) {
        socket.emit("ice candidate", { iceCandidate: e.candidate, to: remoteId });
    }
}

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (message) {
        socket.emit("chatMessage", { message, from: socket.id, to: remoteId });
        addMessageToChat("You", message); 
        chatInput.value = ""; 
    }
});

function addMessageToChat(user, message) {
    const li = document.createElement("li");
    li.textContent = `${user}: ${message}`;
    chatMessages.appendChild(li);
    chatMessages.scrollTop = chatMessages.scrollHeight; 
}

socket.on("chatMessage", ({ message, from }) => {
    const sender = from === remoteId ? "User B" : "Unknown";
    addMessageToChat(sender, message);
});
