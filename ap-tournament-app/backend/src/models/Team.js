import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  nickname: { type: String, required: true },
});

const teamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  representative: String,
  tag: String,
  logo: String,
  players: [playerSchema],
  tournamentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
});

export default mongoose.model('Team', teamSchema);
