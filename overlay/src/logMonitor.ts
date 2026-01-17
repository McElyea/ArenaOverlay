import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface DraftEvent {
  pack: string[];
  pick: number;
  pickedCards: string[];
  expansion?: string;
}

export class LogMonitor {
  private logPath: string;
  private currentSize: number = 0;
  private watchInterval: NodeJS.Timeout | null = null;
  private currentExpansion: string | undefined;

  constructor(customPath?: string) {
    this.logPath = customPath || this.getDefaultPath();
  }

  private getDefaultPath(): string {
    const home = os.homedir();
    const username = os.userInfo().username;
    
    const paths = [
      // Windows - Default
      path.join(home, 'AppData', 'LocalLow', 'Wizards Of The Coast', 'MTGA', 'Player.log'),
      // Windows - Steam/Other Drives
      'C:/Program Files (x86)/Steam/steamapps/compatdata/2141910/pfx/drive_c/users/steamuser/AppData/LocalLow/Wizards Of The Coast/MTGA/Player.log',
      'D:/AppData/LocalLow/Wizards Of The Coast/MTGA/Player.log',
      
      // macOS
      path.join(home, 'Library', 'Logs', 'Wizards Of The Coast', 'MTGA', 'Player.log'),
      
      // Linux - Bottles
      path.join(home, '.var', 'app', 'com.usebottles.bottles', 'data', 'bottles', 'bottles', 'MTG-Arena', 'drive_c', 'users', username, 'AppData', 'LocalLow', 'Wizards Of The Coast', 'MTGA', 'Player.log'),
      // Linux - Lutris
      path.join(home, 'Games', 'magic-the-gathering-arena', 'drive_c', 'users', username, 'AppData', 'LocalLow', 'Wizards Of The Coast', 'MTGA', 'Player.log'),
    ];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        console.log(`Found Arena log at: ${p}`);
        return p;
      }
    }

    // Fallback to default
    return paths[0];
  }

  public start(onDraftEvent: (event: DraftEvent) => void) {
    console.log(`Monitoring log at: ${this.logPath}`);
    
    if (!fs.existsSync(this.logPath)) {
      console.error('Log file not found');
      return;
    }

    const stats = fs.statSync(this.logPath);
    // For testing/simulation, if the file is very small or we just started, 
    // we might want to read a bit of the past, but usually starting at current size is safest for "live" monitoring.
    this.currentSize = stats.size;

    console.log(`Initial log size: ${this.currentSize}`);

    this.watchInterval = setInterval(() => {
      const newStats = fs.statSync(this.logPath);
      if (newStats.size > this.currentSize) {
        this.processNewLines(onDraftEvent);
        this.currentSize = newStats.size;
      } else if (newStats.size < this.currentSize) {
        // Log truncated/rotated
        this.currentSize = newStats.size;
      }
    }, 1000);
  }

  private processNewLines(onDraftEvent: (event: DraftEvent) => void) {
    const stream = fs.createReadStream(this.logPath, {
      start: this.currentSize,
      encoding: 'utf8'
    });

    stream.on('data', (chunk: string) => {
      // 1. Detect Expansion
      // Look for "Event_Join" or similar patterns: "PremierDraft_DSK_20240924"
      const expansionMatch = /"InternalEventName":\s*"(?:PremierDraft|QuickDraft|TradDraft)_([A-Z0-9]+)_/i.exec(chunk);
      if (expansionMatch) {
        this.currentExpansion = expansionMatch[1].toUpperCase();
        console.log(`Detected expansion: ${this.currentExpansion}`);
      }

      // 2. Parse Draft Events
      if (chunk.includes('Draft.Notify') || chunk.includes('DraftPack')) {
        this.parseChunk(chunk, onDraftEvent);
      }
    });
  }

  private parseChunk(chunk: string, onDraftEvent: (event: DraftEvent) => void) {
    const draftPackRegex = /"DraftPack":\s*\[(.*?)\]/g;
    const pickedCardsRegex = /"PickedCards":\s*\[(.*?)\]/g;
    const pickNumberRegex = /"PickNumber":\s*(\d+)/g;

    let packMatch = draftPackRegex.exec(chunk);
    let pickedMatch = pickedCardsRegex.exec(chunk);
    let pickNumberMatch = pickNumberRegex.exec(chunk);

    if (packMatch) {
      try {
        const cardIds = packMatch[1].split(',').map(id => id.trim().replace(/"/g, ''));
        const pickedIds = pickedMatch ? pickedMatch[1].split(',').map(id => id.trim().replace(/"/g, '')) : [];
        const pickNumber = pickNumberMatch ? parseInt(pickNumberMatch[1]) : 0;
        
        onDraftEvent({
          pack: cardIds,
          pick: pickNumber,
          pickedCards: pickedIds,
          expansion: this.currentExpansion
        });
      } catch (e) {
        console.error('Failed to parse draft event', e);
      }
    }
  }

  public stop() {
    if (this.watchInterval) clearInterval(this.watchInterval);
  }
}
