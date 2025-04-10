export function test_connection(url) {
    const random_number = Math.floor(Math.random() * 1000); // Gera um número aleatório entre 0 e 999
    const user_name = `test-${random_number}`; // Nome do usuário
    const test_socket = io(url, {
      query: {
        room: 'test-room',
        user: user_name,
        room_name: 'Test Room',
        card_date: new Date().toISOString()
      },
      reconnection: false,
      timeout: 5000
    });
  
    // Armazenará as conexões RTCPeerConnection indexadas por peer id
    const peerConnections = {};
    // Configurações para o RTCPeerConnection (STUN)
    const pcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };
  
    let localStream = null;
    let isLocalStreamReady = false;
    // Conjunto para armazenar IDs que chegarem via "call" antes de o stream estar pronto
    const pendingPeers = new Set();
  
    // Função para criar a conexão RTCPeerConnection e configurar os eventos
    function createPeerConnection(peerId) {
      const pc = new RTCPeerConnection(pcConfig);
  
      // Adiciona as tracks do stream local (se disponível)
      if (localStream) {
        localStream.getTracks().forEach(track => {
          pc.addTrack(track, localStream);
        });
      }
  
      // Quando receber uma track remota, cria (ou atualiza) o elemento de vídeo correspondente
      pc.ontrack = (event) => {
        console.log(`Recebendo stream remoto de ${peerId}`);
        let remoteVideo = document.getElementById(`video_${peerId}`);
        if (!remoteVideo) {
          remoteVideo = document.createElement('video');
          remoteVideo.id = `video_${peerId}`;
          remoteVideo.autoplay = true;
          document.body.appendChild(remoteVideo);
        }
        remoteVideo.srcObject = event.streams[0];
      };
  
      // Quando houver um ICE candidate, envia para o peer correspondente
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          test_socket.emit('candidate', { id: peerId, candidate: event.candidate });
        }
      };
  
      return pc;
    }
  
    // Inicializa o stream local e cria o próprio elemento de vídeo
    async function initLocalStream() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        const localVideo = document.createElement('video');
        localVideo.id = `video_${test_socket.id}`;
        localVideo.srcObject = localStream;
        localVideo.autoplay = true;
        localVideo.muted = true; // Para evitar eco
        document.body.appendChild(localVideo);
        isLocalStreamReady = true;
        // Para os peers que chegaram enquanto o stream não estava pronto
        pendingPeers.forEach(peerId => {
          initiateConnection(peerId);
        });
        pendingPeers.clear();
      } catch (err) {
        console.error('Erro ao acessar a webcam:', err);
      }
    }
  
    // Função que inicia a conexão com um peer específico
    async function initiateConnection(peerId) {
      if (peerConnections[peerId]) return;
      const pc = createPeerConnection(peerId);
      peerConnections[peerId] = pc;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        test_socket.emit('offer', { id: peerId, offer: pc.localDescription });
      } catch (err) {
        console.error('Erro ao criar oferta:', err);
      }
    }
  
    // Ao conectar, inicializa o stream local
    test_socket.on('connect', async () => {
      console.log(`Conectado ao servidor ${url}`);
      await initLocalStream();
    });
  
    // Evento "call": disparado quando alguém entra na sala.
    test_socket.on('call', (data) => {
      // Ignora se for o próprio socket
      if (data.id === test_socket.id) return;
      
      console.log(`Evento 'call' recebido: novo peer ${data.id}`);
      // Usamos comparação lexicográfica para definir qual peer inicia a conexão
      // Se meu ID for "menor", inicio a conexão com o peer novo
      if (test_socket.id.localeCompare(data.id) < 0) {
        // Se o stream ainda não estiver pronto, guarda o ID para iniciar mais tarde
        if (!isLocalStreamReady) {
          pendingPeers.add(data.id);
        } else {
          initiateConnection(data.id);
        }
      }
    });
  
    // Ao receber uma oferta, responde com uma answer
    test_socket.on('offer', async (data) => {
      const peerId = data.id;
      console.log(`Recebeu oferta de: ${peerId}`);
      let pc = peerConnections[peerId];
      if (!pc) {
        pc = createPeerConnection(peerId);
        peerConnections[peerId] = pc;
      }
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        test_socket.emit('answer', { id: peerId, answer: pc.localDescription });
      } catch (err) {
        console.error('Erro ao processar a oferta:', err);
      }
    });
  
    // Ao receber uma answer à oferta enviada
    test_socket.on('answer', async (data) => {
      const peerId = data.id;
      console.log(`Recebeu resposta de: ${peerId}`);
      const pc = peerConnections[peerId];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (err) {
          console.error('Erro ao setar descrição remota:', err);
        }
      }
    });
  
    // Ao receber um candidato ICE
    test_socket.on('candidate', async (data) => {
      const peerId = data.id;
      const pc = peerConnections[peerId];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.error('Erro ao adicionar candidato ICE:', err);
        }
      }
    });
  
    // Remove o vídeo e a conexão quando um usuário se desconectar
    test_socket.on('disconnect-user', (data) => {
      console.log('Usuário desconectado:', data.id);
      const video_element = document.getElementById(`video_${data.id}`);
      if (video_element) {
        video_element.remove();
      }
      if (peerConnections[data.id]) {
        peerConnections[data.id].close();
        delete peerConnections[data.id];
      }
    });
  
    test_socket.on('connect_error', function (error) {
      console.error(`Erro ao conectar a ${url}:`, error);
      test_socket.disconnect();
    });
  }
  