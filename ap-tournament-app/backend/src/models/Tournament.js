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
    certificateTemplate: String,
    certificatePlaceholders: {
      teamName: { x: { type: Number, default: 50 }, y: { type: Number, default: 48 } },
      rank: { x: { type: Number, default: 50 }, y: { type: Number, default: 38 } },
      tournamentName: { x: { type: Number, default: 50 }, y: { type: Number, default: 58 } },
      date: { x: { type: Number, default: 50 }, y: { type: Number, default: 68 } },
    },
    certificateStyle: {
      displayFont: { type: String, default: 'Orbitron' },
      bodyFont: { type: String, default: 'Montserrat' },
      rankWeight: { type: String, default: '800' },
      teamWeight: { type: String, default: '700' },
      colors: {
        rank: { type: String, default: '#F59E0B' },
        team: { type: String, default: '#FFF7ED' },
        tournament: { type: String, default: '#FCD34D' },
        date: { type: String, default: '#A8A29E' },
      },
    },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
  },
  { timestamps: true }
);

export default mongoose.model('Tournament', tournamentSchema);
