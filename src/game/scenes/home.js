import io from 'socket.io-client';

class home extends Phaser.Scene {
  constructor() {
    super("home");
    this.players = {}; // Store other players' stars
    this.localStream = null;
    this.peerConnections = {}; // Store peer connections
    this.muted = false; // Mute status
    this.videoOff = false; // Video off status
  }

  create() {
    // Set up WebSocket connection
    this.socket = io('ws://192.168.202.98:3000'); // Replace with your server's IP address

    // Create the player-controlled star
    this.star = this.add.image(111, 168, "star");

    // Keyboard inputs for controlling the star
    this.keyboard_key_up = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyboard_key_down = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyboard_key_right = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyboard_key_left = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);

    // Listen for the initial star position (for this player)
    this.socket.on('newStar', (data) => {
      this.star.setPosition(data.x, data.y);
      this.playerId = data.id; // Store the player's socket ID
    });

    // Listen for other players' stars
    this.socket.on('newPlayer', (data) => {
      const newStar = this.add.image(data.x, data.y, "star").setName(data.id);
      this.players[data.id] = newStar; // Store this player's star
    });

    // Listen for updates to other players' stars
    this.socket.on('starMoved', (data) => {
      if (this.players[data.id]) {
        this.players[data.id].setPosition(data.x, data.y);
      }
    });

    // Handle player disconnection
    this.socket.on('playerDisconnected', (data) => {
      if (this.players[data.id]) {
        this.players[data.id].destroy(); // Remove the disconnected player's star
        delete this.players[data.id];
      }
    });

    // Handle receiving all current players
    this.socket.on('currentPlayers', (players) => {
      Object.keys(players).forEach((playerId) => {
        if (playerId !== this.playerId) {
          const player = players[playerId];
          const newStar = this.add.image(player.x, player.y, "star").setName(playerId);
          this.players[playerId] = newStar;
        }
      });
    });

    // Initialize WebRTC
    this.initializeWebRTC();
  }

  initializeWebRTC() {
    // Access local video and audio stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        this.localStream = stream;

        // Display local video in the DOM (create a video element)
        const localVideo = document.createElement('video');
        localVideo.srcObject = stream;
        localVideo.play();
        localVideo.style.position = 'absolute';
        localVideo.style.bottom = '10px';  // Adjust position
        localVideo.style.left = '10px';  // Adjust position
        localVideo.style.width = '200px';  // Adjust size
        localVideo.style.height = 'auto';
        document.body.appendChild(localVideo);

        // Start listening for offer requests from other players
        this.socket.on('offer', (data) => this.handleOffer(data));
        this.socket.on('answer', (data) => this.handleAnswer(data));
        this.socket.on('ice-candidate', (data) => this.handleICECandidate(data));

        // Create buttons for mute and video off
        this.createMediaControlButtons();
      })
      .catch(err => console.error('Error accessing media devices: ', err));
  }

  createMediaControlButtons() {
    // Set background to black
    document.body.style.backgroundColor = 'black';
    document.body.style.color = 'white';

    // Create Mute Button (🎤 / 🔇)
    const muteButton = document.createElement('button');
    muteButton.innerHTML = '🎤'; // Default is audio on
    muteButton.style.position = 'absolute';
    muteButton.style.bottom = '10px';
    muteButton.style.left = '220px';  // Position beside local video
    muteButton.style.fontSize = '30px';
    muteButton.style.padding = '10px';
    muteButton.style.backgroundColor = '#333';
    muteButton.style.color = 'white';
    muteButton.style.border = 'none';
    muteButton.style.borderRadius = '5px';
    muteButton.style.cursor = 'pointer';
    muteButton.onclick = () => this.toggleMute(muteButton);
    document.body.appendChild(muteButton);

    // Create Video Off Button (🎥 / 🔴)
    const videoOffButton = document.createElement('button');
    videoOffButton.innerHTML = '🎥'; // Default is video on
    videoOffButton.style.position = 'absolute';
    videoOffButton.style.bottom = '10px';
    videoOffButton.style.left = '300px';  // Position beside mute button
    videoOffButton.style.fontSize = '30px';
    videoOffButton.style.padding = '10px';
    videoOffButton.style.backgroundColor = '#333';
    videoOffButton.style.color = 'white';
    videoOffButton.style.border = 'none';
    videoOffButton.style.borderRadius = '5px';
    videoOffButton.style.cursor = 'pointer';
    videoOffButton.onclick = () => this.toggleVideoOff(videoOffButton);
    document.body.appendChild(videoOffButton);
  }

  toggleMute(muteButton) {
    this.muted = !this.muted;
    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach(track => track.enabled = !this.muted);
    
    // Change the mute button emoji based on mute status
    muteButton.innerHTML = this.muted ? '🔇' : '🎤';
  }

  toggleVideoOff(videoOffButton) {
    this.videoOff = !this.videoOff;
    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach(track => track.enabled = !this.videoOff);

    // Change the video button emoji based on video status
    videoOffButton.innerHTML = this.videoOff ? '🔴' : '🎥';
  }

  // Handle incoming offer
  handleOffer(data) {
    const peerConnection = new RTCPeerConnection();
    this.peerConnections[data.id] = peerConnection;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', { to: data.id, candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      const remoteVideo = document.createElement('video');
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.play();
      remoteVideo.style.position = 'absolute';
      remoteVideo.style.bottom = '10px';
      remoteVideo.style.right = '10px';
      remoteVideo.style.width = '200px';
      remoteVideo.style.height = 'auto';
      document.body.appendChild(remoteVideo);
    };

    this.localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, this.localStream);
    });

    peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer))
      .then(() => {
        return peerConnection.createAnswer();
      })
      .then((answer) => {
        return peerConnection.setLocalDescription(answer);
      })
      .then(() => {
        this.socket.emit('answer', { to: data.id, answer: peerConnection.localDescription });
      });
  }

  // Handle incoming answer
  handleAnswer(data) {
    const peerConnection = this.peerConnections[data.id];
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  }

  // Handle incoming ICE candidate
  handleICECandidate(data) {
    const peerConnection = this.peerConnections[data.to];
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }

  // Send offer to a new player
  initiateCall(playerId) {
    const peerConnection = new RTCPeerConnection();
    this.peerConnections[playerId] = peerConnection;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('ice-candidate', { to: playerId, candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      const remoteVideo = document.createElement('video');
      remoteVideo.srcObject = event.streams[0];
      remoteVideo.play();
      remoteVideo.style.position = 'absolute';
      remoteVideo.style.bottom = '10px';
      remoteVideo.style.right = '10px';
      remoteVideo.style.width = '200px';
      remoteVideo.style.height = 'auto';
      document.body.appendChild(remoteVideo);
    };

    this.localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, this.localStream);
    });

    peerConnection.createOffer()
      .then((offer) => {
        return peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        this.socket.emit('offer', { to: playerId, offer: peerConnection.localDescription });
      });
  }
  
  update() {
    if (this.keyboard_key_up.isDown) {
      this.star.y -= 4;
      this.updateStarPosition();
    }
    if (this.keyboard_key_down.isDown) {
      this.star.y += 4;
      this.updateStarPosition();
    }
    if (this.keyboard_key_left.isDown) {
      this.star.x -= 4;
      this.updateStarPosition();
    }
    if (this.keyboard_key_right.isDown) {
      this.star.x += 4;
      this.updateStarPosition();
    }
  }

  // Update star position
  updateStarPosition() {
    const position = { x: this.star.x, y: this.star.y };
    this.socket.emit('moveStar', position);
  }
}

export default home;
