const socket = io();
const videoGrid = document.getElementById('grid');

let stream;
let peer; // Declare peer connection outside the function

// Start capturing the student's video
async function startStudent() {
    console.log("Student trying to access media devices...");
    try {
        // Request media permissions
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log("Student stream started...");
        
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.muted = true; // Mute student's own video
        videoGrid.appendChild(video);

        socket.emit('join', 'student');
        console.log("Student joined the session...");

        // Create peer connection
         peer = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        console.log("Peer connection created...");

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
            console.log("Adding track to peer:", track);
            peer.addTrack(track, stream);
        });

        // Handle incoming tracks
        peer.ontrack = (event) => {
            console.log("Received track from teacher:", event.streams[0]);
            const videoElement = document.createElement('video');
            videoElement.srcObject = event.streams[0];
            videoElement.autoplay = true;
            videoGrid.appendChild(videoElement);
        };

        // Handle ICE candidates
        peer.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Sending ICE candidate to teacher...");
                socket.emit('signal', {
                    signal: event.candidate,
                });
            }
        };

        // Handle incoming signaling
        socket.on('signal', async (data) => {
            if (data.signal) {
                if (data.signal.type === 'offer') {
                    console.log("Received offer from teacher...");
                    await peer.setRemoteDescription(new RTCSessionDescription(data.signal));
                    const answer = await peer.createAnswer();
                    await peer.setLocalDescription(answer);
                    socket.emit('signal', {
                        signal: peer.localDescription,
                    });
                } else if (data.signal.type === 'answer') {
                    console.log("Received answer from teacher...");
                    await peer.setRemoteDescription(new RTCSessionDescription(data.signal));
                } else if (data.signal.candidate) {
                    console.log("Adding ICE candidate from teacher...");
                    await peer.addIceCandidate(new RTCIceCandidate(data.signal));
                }
            }
        });
    } catch (err) {
        console.error('Error accessing media devices:', err);
    }
}


startStudent();
