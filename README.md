# 🐛 Bug Catcher - Hand Tracking Game

An interactive bug-catching game using computer vision and hand tracking technology. Perfect for conference demonstrations and showcasing automated software testing concepts.

## 🎮 Game Features

- **Hand Tracking**: Uses your webcam to detect hand movements in real-time
- **Bug Catching**: Catch falling bugs by moving your hands over them
- **Splash Effects**: Satisfying particle effects when bugs are squashed
- **Background Music**: Immersive audio experience with smart controls
- **Professional Branding**: Clean elevaite365 company branding
- **5-Second Hold Restart**: Prevents accidental game restarts
- **3-Strike System**: Game over after missing 3 bugs
- **Debug Mode**: Add `?debug=true` to URL for development features

## 🚀 Live Demo

Visit the live game: [https://yourusername.github.io/AIGame](https://yourusername.github.io/AIGame)

## 🛠️ Technology Stack

- **Hand Tracking**: HandTrack.js library
- **Graphics**: HTML5 Canvas API
- **Audio**: Web Audio API + HTML5 Audio
- **Styling**: CSS3 with gradients and animations
- **Deployment**: GitHub Pages

## 📋 Requirements

- Modern web browser with webcam support
- HTTPS connection (required for webcam access)
- Good lighting for optimal hand detection

## 🎯 How to Play

1. **Allow webcam access** when prompted
2. **Position yourself** in front of the camera with good lighting
3. **Move your hands** to catch the falling red bugs
4. **Avoid missing** more than 3 bugs or it's game over!
5. **Hold the restart button** for 5 seconds to play again

## 🔧 Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/AIGame.git
   cd AIGame
   ```

2. Serve the files using a local server (required for webcam access):
   ```bash
   # Using Python 3
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

3. Open `http://localhost:8000` in your browser

## 📁 Project Structure

```
AIGame/
├── index.html          # Main HTML file
├── styles.css          # Game styling
├── src/
│   └── main.js         # Game logic and hand tracking
├── bgmusic.mp3         # Background music (add your own)
├── bugsmash.mp3        # Bug squash sound effect (add your own)
├── package.json        # Project metadata
└── README.md           # This file
```

## 🎵 Audio Files

The game expects these audio files (not included in repository):
- `bgmusic.mp3` - Background music for gameplay
- `bugsmash.mp3` - Sound effect when bugs are caught

Add your own audio files or the game will work without sound.

## 🐛 Debug Mode

Add `?debug=true` to the URL to enable debug features:
- Hand detection bounding boxes
- Prediction confidence scores
- Console logging for development

Example: `https://yourusername.github.io/AIGame?debug=true`

## 🏢 About elevaite365

This game was created to demonstrate automated software testing concepts at conferences. The bug-catching metaphor represents how automated testing tools catch software bugs before they reach production.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ for the developer community**
