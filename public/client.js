const userVideo = document.querySelector(".user-video video");
const remoteVideo = document.querySelector(".remote-video video");

let peer;
let remoteId;

const socket = io();

const userVolumeMeter = document.querySelector(".user-volume");
const remoteVolumeMeter = document.querySelector(".remote-volume");

const createVolumeBar = (container) => {
    const bar = document.createElement("div");
    container.appendChild(bar);
    return bar;
};

const userVolumeBar = createVolumeBar(userVolumeMeter);
const remoteVolumeBar = createVolumeBar(remoteVolumeMeter);

let userAudioContext;
let userAnalyser;
let userSource;

let remoteAudioContext;
let remoteAnalyser;

function setupAudioMeter(stream, volumeBar) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function updateVolume() {
        analyser.getByteFrequencyData(dataArray);
        let values = 0;
        for (let i = 0; i < dataArray.length; i++) {
            values += dataArray[i];
        }
        const average = values / dataArray.length;
        const volumePercent = Math.min(100, Math.max(0, average / 2));
        volumeBar.style.width = volumePercent + "%";
        requestAnimationFrame(updateVolume);
    }
    updateVolume();

    return { audioContext, analyser, source };
}

socket.on("ada user lain", async (joinedUsers) => {
    remoteId = joinedUsers.find(userId => userId !== socket.id);
    await createPeerConnection();
});

socket.on("offer", async ({ offer, from }) => {
    remoteId = from;
    await createPeerConnection();
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { answer, to: remoteId, from: socket.id });
});

socket.on("ice candidate", async (iceCandidate) => {
    try {
        const candidate = new RTCIceCandidate(iceCandidate);
        await peer.addIceCandidate(candidate);
        console.log("success add ice candidate");
    } catch (error) {
        console.warn("Failed to add ice candidate", error);
    }
});

socket.on("answer", async ({ answer, from }) => {
    await peer.setRemoteDescription(new RTCSessionDescription(answer));
});

async function createPeerConnection() {
    peer = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.stunprotocol.org" },
            {
                urls: "turn:numb.viagenie.ca",
                username: "webrtc@live.com",
                credential: "muazkh"
            }
        ]
    });

    const userStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    userVideo.muted = true;
    userVideo.srcObject = userStream;
    userVideo.onloadedmetadata = () => {
        userVideo.play();
    };
    userStream.getTracks().forEach(track => peer.addTrack(track, userStream));

    if (userAudioContext) {
        userAudioContext.close();
    }
    const userAudioSetup = setupAudioMeter(userStream, userVolumeBar);
    userAudioContext = userAudioSetup.audioContext;
    userAnalyser = userAudioSetup.analyser;
    userSource = userAudioSetup.source;

    peer.onicecandidate = handleIceCandidateEvent;
    peer.ontrack = handleTrackEvent;
    peer.onnegotiationneeded = handleNegotiationNeededEvent;
}

function handleNegotiationNeededEvent() {
    peer.createOffer().then(offer => {
        return peer.setLocalDescription(offer);
    }).then(() => {
        socket.emit("offer", { offer: peer.localDescription, to: remoteId, from: socket.id });
    }).catch(console.error);
}

function handleTrackEvent(e) {
    const [stream] = e.streams;
    remoteVideo.srcObject = stream;
    remoteVideo.muted = false;
    remoteVideo.onloadedmetadata = () => {
        remoteVideo.play();
    };

    if (remoteAudioContext) {
        remoteAudioContext.close();
    }
    const remoteAudioSetup = setupAudioMeter(stream, remoteVolumeBar);
    remoteAudioContext = remoteAudioSetup.audioContext;
    remoteAnalyser = remoteAudioSetup.analyser;
}

function handleIceCandidateEvent(e) {
    if (e.candidate) {
        socket.emit("ice candidate", { iceCandidate: e.candidate, to: remoteId, from: socket.id });
    }
}
