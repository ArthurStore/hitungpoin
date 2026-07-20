import mongoose from 'mongoose';

const matchConfigSchema = new mongoose.Schema({
  matchNumber: Number,
  map: {
    type: String,
    enum: ['Bermuda', 'Purgatory', 'Kalahari', 'Nexterra', 'Alpine', 'Solara'],
    default: 'Bermuda',
  },
  scheduledAt: Date,
});

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    logo: String,
    format: {
      type: String,
      enum: ['Fast Tour', 'One Day', 'Champions Rush'],
      default: 'One Day',
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'cancelled'],
      default: 'draft',
    },
    targetPoints: { type: Number, default: 80 },
    totalMatches: { type: Number, default: 6 },
    matchConfigs: [matchConfigSchema],
    scoringRules: {
      placementPoints: {
        type: Map,
        of: Number,
        default: () =>
          new Map([
            ['1', 12], ['2', 9], ['3', 8], ['4', 7], ['5', 6],
            ['6', 5], ['7', 4], ['8', 3], ['9', 2], ['10', 1],
            ['11', 0], ['12', 0],
          ]),
      },
      killPoint: { type: Number, default: 1 },
      booyahBonus: { type: Number, default: 5 },
    },
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    winnerTeamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    startDate: Date,
    endDate: Date,
  },
  { timestamps: true }
);

export default mongoose.model('Tournament', tournamentSchema);
