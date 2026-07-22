import mongoose from 'mongoose';

const matchConfigSchema = new mongoose.Schema({
  matchNumber: Number,
  map: { type: String, default: 'Bermuda' },
});

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    logo: String,
    format: { type: String, enum: ['Fast Tour', 'One Day', 'Champions Rush', 'CR League'], default: 'One Day' },
    inputMode: { type: String, enum: ['cr_biasa', 'cr_league'], default: 'cr_biasa' },
    status: { type: String, enum: ['draft', 'active', 'completed'], default: 'active' },
    targetPoints: { type: Number, default: 80 },
    totalMatches: { type: Number, default: 6 },
    matchConfigs: [matchConfigSchema],
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scoringRules: {
      placementPoints: { type: Map, of: Number },
      killPoint: { type: Number, default: 1 },
      booyahBonus: { type: Number, default: 5 },
    },
    leaderboardSubtitle: { type: String, default: 'KLASEMEN GRAND FINAL' },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  },
  { timestamps: true }
);

export default mongoose.model('Tournament', tournamentSchema);
