document.addEventListener('DOMContentLoaded', function() {
    const start_call_button = document.getElementById('start-call-button');

    if (start_call_button) {
        const video_call_dialog = document.createElement('dialog');
        video_call_dialog.id = 'video-call-dialog';
        const video_call_container = document.createElement('div');
        video_call_container.id = 'video-call-container';
        const video_call_element = document.createElement('videocall');
        const user_element = document.createElement('user');
        const close_dialog_button = document.createElement('button');
        close_dialog_button.id = 'close-dialog-button';
        close_dialog_button.textContent = 'Close';

        video_call_element.appendChild(user_element);
        video_call_container.appendChild(video_call_element);
        video_call_dialog.appendChild(video_call_container);
        video_call_dialog.appendChild(close_dialog_button);
        document.body.appendChild(video_call_dialog);

        start_call_button.addEventListener('click', () => {
            const start_call_dialog = document.createElement('dialog');
            start_call_dialog.id = 'start-call-dialog';
            const start_call_confirm_button = document.createElement('button');
            start_call_confirm_button.id = 'start-call-confirm-button';
            start_call_confirm_button.textContent = 'Iniciar Chamada';
            start_call_dialog.appendChild(start_call_confirm_button);
            document.body.appendChild(start_call_dialog);

            start_call_confirm_button.addEventListener('click', () => {
                const existing_video = document.getElementById('preview-player');
                if (existing_video) {
                    existing_video.remove();
                }

                const videocall = document.createElement('videocall');
                const user = document.createElement('user');
                const video_element = document.createElement('video');
                video_element.id = 'preview-player';
                video_element.autoplay = true;
                video_element.muted = true;

                user.appendChild(video_element);
                videocall.appendChild(user);
                document.body.appendChild(videocall);

                video_call_dialog.showModal();
                start_call_dialog.close();

                // Execute the async function after the dialog is opened
                (async function (){ 
                    let existing_videocall = document.querySelector('videocall');
                    if (existing_videocall) {
                        existing_videocall.remove();
                    }

                    let videocall = document.createElement('videocall');
                    let videocall_domparser = new DOMParser().parseFromString('<user><video id="preview-player" autoplay muted></video></user>', 'text/html');
                    let video = videocall_domparser.body.childNodes[0];

                    document.body.insertBefore(videocall, document.body.firstChild);
                    document.querySelector('videocall').append(video);    
                    const data = {
                        room: 'mehfius',
                        user: crypto.randomUUID(),
                        room_name: 'Sala Mehfius',
                        card_date: new Date().toISOString()
                    };

                    var getUserMedia
                    var myStream
                    var socket
                    const users = new Map()

                    async function start(data) {
                        try {
                            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

                            screenStream.getAudioTracks().forEach(track => {
                                screenStream.addTrack(track);
                            });

                            myStream = screenStream;
                            document.getElementById('preview-player').srcObject = myStream;
                            socket = initServerConnection(data);
                        } catch (err) {
                            console.log(err);
                            alert(err);
                        }
                    }

                    function initServerConnection(data) {
                        var socket = io('https://supacall.onrender.com', {    
                            query: {
                                room: data.room,
                                user: data.user,
                                room_name: data.room_name,
                                card_date: data.card_date
                            }
                        });

                        document.querySelector('videocall').setAttribute("status", "entrando");

                        socket.on('connect', function () {
                            console.log('Connected to server');
                            document.querySelector('videocall').setAttribute("status", "conectado");
                        });

                        socket.on('connect_error', function (error) {
                            console.error('Connection error:', error);
                            document.querySelector('videocall').setAttribute("status", "erro");
                        });

                        socket.on('disconnect-user', function (data) {
                            console.log('User disconnected:', data.id);
                            var user = users.get(data.id);
                            if (user) {
                                users.delete(data.id);
                                user.selfDestroy();
                            }
                        });

                        socket.on('call', function (data) {
                            console.log('Received call from:', data.id);
                            let user = new User(data.id);
                            user.pc = createPeer(user);
                            users.set(data.id, user);
                            createOffer(user, socket);
                        });

                        socket.on('offer', function (data) {
                            console.log('Received offer from:', data.id);
                            var user = users.get(data.id);
                            if (user) {
                                answerPeer(user, data.offer, socket);
                            } else {
                                let user = new User(data.id);
                                user.pc = createPeer(user);
                                users.set(data.id, user);
                                answerPeer(user, data.offer, socket);
                            }
                        });

                        socket.on('answer', function (data) {
                            console.log('Received answer from:', data.id);
                            var user = users.get(data.id);
                            if (user) {
                                user.pc.setRemoteDescription(data.answer);
                            }
                        });

                        socket.on('candidate', function (data) {
                            console.log('Received ICE candidate from:', data.id);
                            var user = users.get(data.id);
                            if (user) {
                                user.pc.addIceCandidate(data.candidate);
                            } else {
                                let user = new User(data.id);
                                user.pc = createPeer(user);
                                user.pc.addIceCandidate(data.candidate);
                                users.set(data.id, user);
                            }
                        });

                        return socket;
                    }

                    function leave() {
                        socket.close();
                        for (var user of users.values()) {
                            user.selfDestroy();
                        }
                        users.clear();
                    }

                    function addVideoPlayer(stream) {
                        var template = new DOMParser().parseFromString('<user><video autoplay volume="10"></video></user>', 'text/html');
                        template.getElementsByTagName('video')[0].srcObject = stream;

                        var divPlayer = template.body.childNodes[0];
                        var videocall = document.querySelector("videocall");

                        videocall.appendChild(divPlayer);

                        return divPlayer;
                    }

                    class User {
                        constructor(id) {
                            this.id = id;
                        }

                        selfDestroy() {
                            if (this.player) {
                                this.player.remove();
                            }

                            if (this.pc) {
                                this.pc.close();
                                this.pc.onicecandidate = null;
                                this.pc.ontrack = null;
                                this.pc = null;
                            }
                        }

                        sendMessage(message) {
                            if (this.dc) {
                                this.dc.send(message);
                            }
                        }
                    }

                    const { RTCPeerConnection } = window;

                    function createPeer(user) {
                        const rtcConfiguration = {
                            iceServers: [{
                                urls: 'stun:stun.l.google.com:19302'
                            }]
                        };
                        var pc = new RTCPeerConnection(rtcConfiguration);
                        pc.onicecandidate = function (event) {
                            if (!event.candidate) {
                                return;
                            }

                            socket.emit('candidate', {
                                id: user.id,
                                candidate: event.candidate
                            });
                        };

                        for (const track of myStream.getTracks()) {
                            pc.addTrack(track, myStream);
                        }

                        pc.ontrack = function (event) {
                            if (user.player) {
                                return;
                            }
                            user.player = addVideoPlayer(event.streams[0]);
                        };

                        pc.ondatachannel = function (event) {
                            user.dc = event.channel;
                            setupDataChannel(user.dc);
                        };

                        return pc;
                    }

                    function createOffer(user, socket) {
                        user.dc = user.pc.createDataChannel('chat');
                        setupDataChannel(user.dc);

                        user.pc.createOffer().then(function (offer) {
                            user.pc.setLocalDescription(offer).then(function () {
                                socket.emit('offer', {
                                    id: user.id,
                                    offer: offer
                                });
                            });
                        });
                    }

                    function answerPeer(user, offer, socket) {
                        user.pc.setRemoteDescription(offer).then(function () {
                            user.pc.createAnswer().then(function (answer) {
                                user.pc.setLocalDescription(answer).then(function () {
                                    socket.emit('answer', {
                                        id: user.id,
                                        answer: answer
                                    });
                                });
                            });
                        });
                    }

                    function setupDataChannel(dataChannel) {
                        dataChannel.onopen = checkDataChannelState;
                        dataChannel.onclose = checkDataChannelState;
                        dataChannel.onmessage = function (e) {
                            addMessage(e.data);
                        };
                    }

                    function checkDataChannelState(dataChannel) {
                        console.log('WebRTC channel state is:', dataChannel.type);
                    }
                })();
            });

            start_call_dialog.showModal();
        });

        close_dialog_button.addEventListener('click', () => {
            video_call_dialog.close();
        });

        video_call_dialog.addEventListener('click', (event) => {
            if (event.target === video_call_dialog) {
                video_call_dialog.close();
            }
        });
    } else {
        console.error('Could not find start call button.');
    }
}); 