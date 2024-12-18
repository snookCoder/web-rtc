const socket = io();
const videoGrid = document.getElementById('grid');

const peerConnections = {};

// Start teacher session
console.log("Teacher joining...");
socket.emit('join', 'teacher');

// Handle new student connections
socket.on('new-student', (studentId) => {
    console.log("New student joined:", studentId);
    connectToStudent(studentId);
});

// Handle initial student list
socket.on('student-list', (students) => {
    console.log("Initial student list received:", students);
    students.forEach((studentId) => {
        if (!peerConnections[studentId]) {
            console.log("Connecting to student:", studentId);
            connectToStudent(studentId);
        }
    });
});

// Handle disconnected students
socket.on('student-disconnected', (studentId) => {
    console.log("Student disconnected:", studentId);
    if (peerConnections[studentId]) {
        peerConnections[studentId].close();
        delete peerConnections[studentId];
        const video = document.getElementById(studentId);
        if (video) video.remove();
    }
});

// Connect to a student
function connectToStudent(studentId) {
    console.log('Connecting to student:', studentId);
    const peer = new RTCPeerConnection();

    // Store the peer connection for future reference
    peerConnections[studentId] = peer;

    const video = document.createElement('video');
    video.id = studentId;
    video.autoplay = true;
    video.playsInline = true;
    videoGrid.appendChild(video);

    // Handle received tracks
    peer.ontrack = (event) => {
        console.log("Received track from student:", studentId);
        if (event.streams && event.streams[0]) {
            video.srcObject = event.streams[0];
            console.log("Stream successfully added to video element");
        } else {
            console.error("No streams received for student:", studentId);
        }
    };

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("Sending ICE candidate to student:", studentId);
            socket.emit('signal', {
                to: studentId,
                signal: event.candidate,
            });
        }
    };

    // Handle incoming signaling (offer/answer)
    socket.on('signal', async (data) => {
        if (peerConnections[data.to]) {
            const peer = peerConnections[data.to];
            if (data.signal.type === 'offer') {
                await peer.setRemoteDescription(new RTCSessionDescription(data.signal));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socket.emit('signal', {
                    to: data.to,
                    signal: peer.localDescription,
                });
            } else if (data.signal.type === 'answer') {
                await peer.setRemoteDescription(new RTCSessionDescription(data.signal));
            } else if (data.signal.candidate) {
                await peer.addIceCandidate(new RTCIceCandidate(data.signal));
            }
        }
    });
    

    // Create offer and send it to the student
    peer.createOffer()
        .then((offer) => peer.setLocalDescription(offer))
        .then(() => {
            console.log("Offer set, sending to student:", studentId);
            socket.emit('signal', {
                to: studentId,
                signal: peer.localDescription,
            });
        })
        .catch((error) => {
            console.error("Error during peer connection setup:", error);
        });
}
