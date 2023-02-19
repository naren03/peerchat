//user-1 video and audio feed
const userFeed1 = document.getElementById("user-1");

//user-2 video and audio feed
const userFeed2 = document.getElementById("user-2");

//global variables for connection
let localStream;
let remoteStream;
let peerConnection;

let APP_ID = "76385e34d802498fa1b135c05df597e9";

//set it during production
let token = null;
//generate using a package from npm
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

//STUN Servers
let servers = {
	iceservers: [
		{
			urls: ["stun:stun1.1.google.com:19302", "stun:stun2.1.google.com:19302"],
		},
	],
};

//fires of everytime user refresh
let init = async () => {
	console.log("Initial Execution");

	client = await AgoraRTM.createInstance(APP_ID);
	await client.login({ uid, token });

	//index.html?room=123123
	//channel name can be dynamic based on urls
	channel = client.createChannel("main");
	//it awaits if anyone joins the channel
	await channel.join();

	//if someone joins the channel
	channel.on("MemberJoined", handleUserJoined);

	//if someone sends the message
	client.on("MessageFromPeer", handleMessageFromPeer);

	//getting access to media devices

	localStream = await navigator.mediaDevices.getUserMedia({
		video: true,
		audio: false,
	});

	//setting the local User video feed
	userFeed1.srcObject = localStream;
};

init();
//handle if new user joins
let handleUserJoined = async (MemberId) => {
	console.log("New user joined:", MemberId);

	//call create offer as new user has joined
	createOffer(MemberId);
};

//handle if peer sends something
let handleMessageFromPeer = async (msg, MemberId) => {
	console.log(msg.text);

	msg = JSON.parse(msg.text);

	if (msg.type === "offer") {
		//if user gets an offer create a answer
		createAnswer(MemberId, msg.offer);
	}

	if (msg.type === "answer") {
		//if user gets an answer add him and strt chat
		addAnswer(msg.answer);
	}

	if (msg.type === "candidate") {
		//if new icecandidate is added
		if (peerConnection) {
			peerConnection.addIceCandidate(msg.candidate);
		}
	}
};

//create connection
let createConnection = async (MemberId) => {
	console.log("Create Connection:", MemberId);
	peerConnection = new RTCPeerConnection(servers);

	remoteStream = new MediaStream();
	//setting the remote user media feed
	userFeed2.srcObject = remoteStream;

	//sending localStream on peerconnection
	localStream.getTracks().forEach((track) => {
		peerConnection.addTrack(track, localStream);
	});

	//receiving remoteStream from peerConnection
	peerConnection.ontrack = async (event) => {
		event.streams[0].getTracks().forEach((track) => {
			remoteStream.addTrack(track);
			console.log("New Track Recevived:", track);
		});
	};

	//whenever a new icecandidate is added
	peerConnection.onicecandidate = async (event) => {
		if (event.candidate) {
			console.log("New candidate:", event.candidate);
			client.sendMessageToPeer(
				{
					text: JSON.stringify({
						type: "candidate",
						candidate: event.candidate,
					}),
				},
				MemberId,
			);
		}
	};
};

//Create Offer
let createOffer = async (MemberId) => {
	console.log("New Offer:", MemberId);

	await createConnection(MemberId);
	//creating a new offer
	let offer = await peerConnection.createOffer();

	await peerConnection.setLocalDescription(offer);

	console.log("Offer SDP:", offer);
	console.log("New User::", MemberId);

	//sends offer to the connected peer with memberid as an identifier
	client.sendMessageToPeer(
		{
			text: JSON.stringify({ type: "offer", offer: offer }),
		},
		MemberId,
	);
};

//Create Answer
let createAnswer = async (MemberId, offer) => {
	console.log("create answer");
	//we setup up local desc for the remote like this
	await createConnection(MemberId);

	//setup remote desc
	await peerConnection.setRemoteDescription(offer);

	//create answer
	let answer = await peerConnection.createAnswer();

	//set answer as local description
	await peerConnection.setLocalDescription(answer);

	//sending answer to peer
	client.sendMessageToPeer(
		{
			text: JSON.stringify({ type: "answer", answer: answer }),
		},
		MemberId,
	);
};

//Add Answer
let addAnswer = async (answer) => {
	console.log("add answer");
	//if there is no remote then add a new one
	if (!peerConnection.currentRemoteDescription) {
		peerConnection.setRemoteDescription(answer);
	}
};
