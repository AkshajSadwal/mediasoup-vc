# mediasoup
my-node-backend/
├── node_modules/           # Installed npm packages (git-ignored)
├── src/                    # All source code lives here
│   ├── config/             # Database and environment configurations
│   │   ├── db.config.js
│   │   └── passport.js
│   ├── models/             # Database schemas (Mongoose, Sequelize, etc.)
│   │   ├── User.model.js
│   │   └── Product.model.js
│   ├── mediasoup/
│   │   ├── workers/
│   │   │   └── workerManager.js
│   │   │
│   │   ├── routers/
│   │   │   └── routerManager.js
│   │   │
│   │   ├── transports/
│   │   │   ├── transportManager.js
│   │   │   └── webRtcTransport.js
│   │   │
│   │   ├── producers/
│   │   │   └── producerManager.js
│   │   │
│   │   ├── consumers/
│   │   │   └── consumerManager.js
│   │   │
│   │   ├── rooms/
│   │   │   ├── Room.js
│   │   │   └── roomManager.js
│   │   │
│   │   └── peers/
│   │       ├── Peer.js
│   │       └── peerManager.js
│   │
│   ├── socket/
│   │   ├── index.js
│   │   ├── socketHandlers.js
│   │   └── events/
│   │       ├── room.events.js
│   │       ├── transport.events.js
│   │       ├── producer.events.js
│   │       └── consumer.events.js
│   └── app.js              # Express app initialization & middleware configuration
├── tests/                  # Unit and integration tests
│   └── user.test.js
├── .env                    # Local environment secrets (never commit to git)
├── .env.example            # Placeholder env keys for other developers
├── .gitignore              # Files ignored by Git
├── package.json            # Scripts, project metadata, and dependencies
├── README.md               # Project documentation
└── server.js               # App entry point (listens to network port)






















│   ├── mediasoup/
│   │   ├── workers/
│   │   │   └── workerManager.js
│   │   │
│   │   ├── routers/
│   │   │   └── routerManager.js
│   │   │
│   │   ├── transports/
│   │   │   ├── transportManager.js
│   │   │   └── webRtcTransport.js
│   │   │
│   │   ├── producers/
│   │   │   └── producerManager.js
│   │   │
│   │   ├── consumers/
│   │   │   └── consumerManager.js
│   │   │
│   │   ├── rooms/
│   │   │   ├── Room.js
│   │   │   └── roomManager.js
│   │   │
│   │   └── peers/
│   │       ├── Peer.js
│   │       └── peerManager.js
│   │
│   ├── socket/
│   │   ├── index.js
│   │   ├── socketHandlers.js
│   │   └── events/
│   │       ├── room.events.js
│   │       ├── transport.events.js
│   │       ├── producer.events.js
│   │       └── consumer.events.js




















# mediasoup
my-node-backend/
├── node_modules/           # Installed npm packages (git-ignored)
├── src/                    # All source code lives here
│   ├── config/             # Database and environment configurations
│   │   ├── db.config.js
│   │   └── passport.js
│   ├── controllers/        # HTTP request & response handlers (thin layer)
│   │   ├── auth.controller.js
│   │   └── user.controller.js
│   ├── models/             # Database schemas (Mongoose, Sequelize, etc.)
│   │   ├── User.model.js
│   │   └── Product.model.js
│   ├── routes/             # API endpoint definitions mapping to controllers
│   │   ├── auth.routes.js
│   │   └── user.routes.js
│   │   └── index.js        # Centralized route aggregator
│   ├── services/           # Core business logic and database queries
│   │   ├── auth.service.js
│   │   └── user.service.js
│   ├── middlewares/        # Custom middleware (auth guards, validators)
│   │   ├── auth.middleware.js
│   │   └── error.middleware.js
│   ├── utils/              # Reusable global helper functions & constants
│   │   ├── logger.js
│   │   └── AppError.js
│   ├── mediasoup/
│   │   ├── workers/
│   │   │   └── workerManager.js
│   │   │
│   │   ├── routers/
│   │   │   └── routerManager.js
│   │   │
│   │   ├── transports/
│   │   │   ├── transportManager.js
│   │   │   └── webRtcTransport.js
│   │   │
│   │   ├── producers/
│   │   │   └── producerManager.js
│   │   │
│   │   ├── consumers/
│   │   │   └── consumerManager.js
│   │   │
│   │   ├── rooms/
│   │   │   ├── Room.js
│   │   │   └── roomManager.js
│   │   │
│   │   └── peers/
│   │       ├── Peer.js
│   │       └── peerManager.js
│   │
│   ├── socket/
│   │   ├── index.js
│   │   ├── socketHandlers.js
│   │   └── events/
│   │       ├── room.events.js
│   │       ├── transport.events.js
│   │       ├── producer.events.js
│   │       └── consumer.events.js
│   └── app.js              # Express app initialization & middleware configuration
├── tests/                  # Unit and integration tests
│   └── user.test.js
├── .env                    # Local environment secrets (never commit to git)
├── .env.example            # Placeholder env keys for other developers
├── .gitignore              # Files ignored by Git
├── package.json            # Scripts, project metadata, and dependencies
├── README.md               # Project documentation
└── server.js               # App entry point (listens to network port)




│   ├── mediasoup/
│   │   ├── workers/
│   │   │   └── workerManager.js
│   │   │
│   │   ├── routers/
│   │   │   └── routerManager.js
│   │   │
│   │   ├── transports/
│   │   │   ├── transportManager.js
│   │   │   └── webRtcTransport.js
│   │   │
│   │   ├── producers/
│   │   │   └── producerManager.js
│   │   │
│   │   ├── consumers/
│   │   │   └── consumerManager.js
│   │   │
│   │   ├── rooms/
│   │   │   ├── Room.js
│   │   │   └── roomManager.js
│   │   │
│   │   └── peers/
│   │       ├── Peer.js
│   │       └── peerManager.js
│   │
│   ├── socket/
│   │   ├── index.js
│   │   ├── socketHandlers.js
│   │   └── events/
│   │       ├── room.events.js
│   │       ├── transport.events.js
│   │       ├── producer.events.js
│   │       └── consumer.events.js