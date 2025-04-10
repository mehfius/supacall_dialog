import { testConnection } from './connection_test.js';

// Test server URLs
const TEST_URLS = [
    "https://supacall.onrender.com",
    "https://socket-io-7yss.onrender.com",
    "http://localhost:10000"
];

document.addEventListener('DOMContentLoaded', function() {
    // Create test connection buttons
    TEST_URLS.forEach(url => {
        const button = document.createElement('button');
        button.textContent = `Testar ${url}`;
        button.addEventListener('click', () => testConnection(url));
        document.querySelector('header category').appendChild(button);
    });

    // Set up the start call button
    const startCallButton = document.getElementById('start-call-button');
    if (startCallButton) {
        startCallButton.addEventListener('click', () => {
            // Only create and show the dialog when the button is clicked
            const videoCallManager = new VideoCallManager();
            videoCallManager.startCall();
        });
    } else {
        console.error('Could not find start call button.');
    }
});

class VideoCallManager {
    constructor() {
        this.users = new Map();
        this.myStream = null;
        this.socket = null;
        this.videoCallDialog = null;
    }

    startCall() {
        // Create a confirmation dialog first
        this.showStartCallDialog();
    }

    showStartCallDialog() {
        // Clean up any existing dialog
        const existingDialog = document.getElementById('start-call-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        const startCallDialog = document.createElement('dialog');
        startCallDialog.id = 'start-call-dialog';
        
        const startCallConfirmButton = document.createElement('button');
        startCallConfirmButton.id = 'start-call-confirm-button';
        startCallConfirmButton.textContent = 'Iniciar Chamada';
        
        startCallDialog.appendChild(startCallConfirmButton);
        document.body.appendChild(startCallDialog);
        
        startCallConfirmButton.addEventListener('click', () => {
            this.createVideoCallDialog();
            this.initializeVideoCall();
            this.videoCallDialog.showModal();
            startCallDialog.close();
        });
        
        startCallDialog.showModal();
    }

    createVideoCallDialog() {
        // Remove existing dialog if present
        const existingDialog = document.getElementById('video-call-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        const videoCallDialog = document.createElement('dialog');
        videoCallDialog.id = 'video-call-dialog';
        
        const videoCallContainer = document.createElement('div');
        videoCallContainer.id = 'video-call-container';
        
        const closeDialogButton = document.createElement('button');
        closeDialogButton.id = 'close-dialog-button';
        closeDialogButton.textContent = 'Close';
        
        videoCallDialog.appendChild(videoCallContainer);
        videoCallDialog.appendChild(closeDialogButton);
        
        document.body.appendChild(videoCallDialog);
        
        closeDialogButton.addEventListener('click', () => {
            videoCallDialog.close();
            this.leave();
        });
        
        videoCallDialog.addEventListener('click', (event) => {
            if (event.target === videoCallDialog) {
                videoCallDialog.close();
                this.leave();
            }
        });
        
        this.videoCallDialog = videoCallDialog;
    }

    async initializeVideoCall() {
        this.cleanupExistingVideocall();
        this.createVideoElement();
        
        const data = {
            room: 'mehfius',
            user: crypto.randomUUID(),
            room_name: 'Sala Mehfius',
            card_date: new Date().toISOString()
        };
        
        try {
            await this.start(data);
        } catch (err) {
            console.error('Failed to start video call:', err);
            alert('Error starting video call: ' + err.message);
        }
    }

    cleanupExistingVideocall() {
        const existingVideocall = document.querySelector('videocall');
        if (existingVideocall) {
            existingVideocall.remove();
        }
    }

    createVideoElement() {
        const videocall = document.createElement('videocall');
        const user = document.createElement('user');
        const videoElement = document.createElement('video');
        videoElement.id = 'preview-player';
        videoElement.autoplay = true;
        videoElement.muted = true;
        
        user.appendChild(videoElement);
        videocall.appendChild(user);
        
        const videoCallContainer = document.getElementById('video-call-container');
        if (videoCallContainer) {
            while (videoCallContainer.firstChild) {
                videoCallContainer.removeChild(videoCallContainer.firstChild);
            }
            videoCallContainer.appendChild(videocall);
        }
    }

    async start(data) {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            screenStream.getAudioTracks().forEach(track => {
                screenStream.addTrack(track);
            });
            
            this.myStream = screenStream;
            const previewPlayer = document.getElementById('preview-player');
            if (previewPlayer) {
                previewPlayer.srcObject = this.myStream;
            }
            
            this.socket = this.initServerConnection(data);
        } catch (err) {
            console.error(err);
            throw err;
        }
    }

    initServerConnection(data) {
        const socket = io('https://supacall.onrender.com', {    
            query: {
                room: data.room,
                user: data.user,
                room_name: data.room_name,
                card_date: data.card_date
            }
        });
        
        const videocall = document.querySelector('videocall');
        if (videocall) {
            videocall.setAttribute("status", "entrando");
        }
        
        socket.on('connect', () => {
            console.log('Connected to server');
            const videocall = document.querySelector('videocall');
            if (videocall) {
                videocall.setAttribute("status", "conectado");
            }
        });
        
        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            const videocall = document.querySelector('videocall');
            if (videocall) {
                videocall.setAttribute("status", "erro");
            }
        });
        
        socket.on('disconnect-user', (data) => {
            console.log('User disconnected:', data.id);
            const user = this.users.get(data.id);
            if (user) {
                this.users.delete(data.id);
                user.selfDestroy();
            }
        });
        
        socket.on('call', (data) => {
            console.log('Received call from:', data.id);
            const user = new User(data.id);
            user.pc = this.createPeer(user);
            this.users.set(data.id, user);
            this.createOffer(user, socket);
        });
        
        socket.on('offer', (data) => {
            console.log('Received offer from:', data.id);
            let user = this.users.get(data.id);
            if (user) {
                this.answerPeer(user, data.offer, socket);
            } else {
                user = new User(data.id);
                user.pc = this.createPeer(user);
                this.users.set(data.id, user);
                this.answerPeer(user, data.offer, socket);
            }
        });
        
        socket.on('answer', (data) => {
            console.log('Received answer from:', data.id);
            const user = this.users.get(data.id);
            if (user) {
                user.pc.setRemoteDescription(data.answer);
            }
        });
        
        socket.on('candidate', (data) => {
            console.log('Received ICE candidate from:', data.id);
            let user = this.users.get(data.id);
            if (user) {
                user.pc.addIceCandidate(data.candidate);
            } else {
                user = new User(data.id);
                user.pc = this.createPeer(user);
                user.pc.addIceCandidate(data.candidate);
                this.users.set(data.id, user);
            }
        });
        
        return socket;
    }

    leave() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        
        if (this.myStream) {
            this.myStream.getTracks().forEach(track => track.stop());
            this.myStream = null;
        }
        
        for (const user of this.users.values()) {
            user.selfDestroy();
        }
        this.users.clear();
    }

    addVideoPlayer(stream) {
        const template = new DOMParser().parseFromString('<user><video autoplay volume="10"></video></user>', 'text/html');
        template.getElementsByTagName('video')[0].srcObject = stream;
        
        const divPlayer = template.body.childNodes[0];
        const videocall = document.querySelector("videocall");
        
        if (videocall) {
            videocall.appendChild(divPlayer);
        }
        
        return divPlayer;
    }

    createPeer(user) {
        const rtcConfiguration = {
            iceServers: [{
                urls: 'stun:stun.l.google.com:19302'
            }]
        };
        
        const pc = new RTCPeerConnection(rtcConfiguration);
        const self = this;
        
        pc.onicecandidate = function(event) {
            if (!event.candidate) {
                return;
            }
            
            self.socket.emit('candidate', {
                id: user.id,
                candidate: event.candidate
            });
        };
        
        if (this.myStream) {
            for (const track of this.myStream.getTracks()) {
                pc.addTrack(track, this.myStream);
            }
        }
        
        pc.ontrack = function(event) {
            if (user.player) {
                return;
            }
            user.player = self.addVideoPlayer(event.streams[0]);
        };
        
        pc.ondatachannel = function(event) {
            user.dc = event.channel;
            self.setupDataChannel(user.dc);
        };
        
        return pc;
    }

    createOffer(user, socket) {
        user.dc = user.pc.createDataChannel('chat');
        this.setupDataChannel(user.dc);
        
        user.pc.createOffer()
            .then(offer => {
                return user.pc.setLocalDescription(offer)
                    .then(() => {
                        socket.emit('offer', {
                            id: user.id,
                            offer: offer
                        });
                    });
            })
            .catch(err => console.error('Error creating offer:', err));
    }

    answerPeer(user, offer, socket) {
        user.pc.setRemoteDescription(offer)
            .then(() => {
                return user.pc.createAnswer();
            })
            .then(answer => {
                return user.pc.setLocalDescription(answer)
                    .then(() => {
                        socket.emit('answer', {
                            id: user.id,
                            answer: answer
                        });
                    });
            })
            .catch(err => console.error('Error answering peer:', err));
    }

    setupDataChannel(dataChannel) {
        dataChannel.onopen = this.checkDataChannelState;
        dataChannel.onclose = this.checkDataChannelState;
        dataChannel.onmessage = (e) => {
            this.addMessage(e.data);
        };
    }

    checkDataChannelState(dataChannel) {
        console.log('WebRTC channel state is:', dataChannel.type);
    }
    
    addMessage(message) {
        console.log('Received message:', message);
        // Implement message handling logic if needed
    }
}

class User {
    constructor(id) {
        this.id = id;
        this.pc = null;
        this.dc = null;
        this.player = null;
    }

    selfDestroy() {
        if (this.player) {
            this.player.remove();
            this.player = null;
        }

        if (this.pc) {
            this.pc.close();
            this.pc.onicecandidate = null;
            this.pc.ontrack = null;
            this.pc = null;
        }
        
        this.dc = null;
    }

    sendMessage(message) {
        if (this.dc) {
            this.dc.send(message);
        }
    }
}