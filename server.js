const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Serve student and teacher views
app.get('/student', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get('/teacher', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Track students and teacher
let teacherSocket = null;
const students = {};

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    socket.on('join', (role) => {
        if (role === 'student') {
            students[socket.id] = socket.id;
            // Notify teacher about the new student
            if (teacherSocket) {
                io.to(teacherSocket).emit('new-student', socket.id);
            }
        } else if (role === 'teacher') {

            teacherSocket = socket.id;
            console.log("teacher socket",teacherSocket);
            console.log("students on teacher shiow",students)
            // Send current student list to the teacher
            socket.emit('student-list', Object.keys(students));
        }
    });

    // Relay signaling data
    socket.on('signal', (data) => {
        io.to(data.to).emit('signal', {
            from: socket.id,
            signal: data.signal,
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        if (students[socket.id]) {
            delete students[socket.id];
            io.to(teacherSocket).emit('student-disconnected', socket.id);
        } else if (socket.id === teacherSocket) {
            teacherSocket = null;
        }
    });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
