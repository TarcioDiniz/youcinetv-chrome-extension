interface SerieDto {
  id: string;
  name: string;
  episodes: NodeListOf<HTMLButtonElement>;
}

interface SerieProgressDto {
  serie: SerieDto;
  currentEpisode: number;
  qtdEpisodes: number;
}

interface VideoProgressDto {
  isPaused: boolean;
  currentTime: string;
  duration: string;
  isFinished: boolean;
}

interface EpisodeDetailsDto {
  currentTime: string;
  duration: string;
  isFinished: boolean;
  currentEpisode: number;
}

interface ISerieDetails {
  getId(): Promise<string>;

  getName(): Promise<string>;

  getEpisodes(): Promise<NodeListOf<HTMLButtonElement>>;

  getCurrentEpisode(buttons: NodeListOf<HTMLButtonElement>): Promise<number>;
}

interface ISerieService {
  getSerie(): Promise<SerieProgressDto>;

  nextEpisode(button: HTMLButtonElement): Promise<any>;

  saveEpisodeDetails(serieId: string, episodeDetails: EpisodeDetailsDto): Promise<void>;

  getEpisodeDetails(serieId: string): Promise<EpisodeDetailsDto>;
}

interface IVideoService {
  getVideo(): Promise<any>;

  getVideoProgress(): Promise<VideoProgressDto>;

  continueEpisode(currentTime: string): Promise<any>;

  formatTime(time: number): string;

  parseTime(formattedTime: string): number;
}

class VideoService implements IVideoService {
  getVideo(): Promise<any> {
    const videoElement = document.querySelector('video');
    return videoElement ? Promise.resolve(videoElement) : Promise.reject(new Error('Video element not found'));
  }

  async getVideoProgress(): Promise<VideoProgressDto> {
    try {
      const videoElement = await this.getVideo();

      const isPaused = videoElement.paused;
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration;

      const isFinished = currentTime >= duration;

      return {
        isPaused: isPaused,
        currentTime: this.formatTime(currentTime),
        duration: this.formatTime(duration),
        isFinished: isFinished
      };
    } catch (error) {
      return Promise.reject(error);
    }
  }

  formatTime(time: number): string {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  // Total em segundos
  parseTime(formattedTime: string): number {
    const [minutes, seconds] = formattedTime.split(':').map(Number);
    return minutes * 60 + seconds;
  };


  async continueEpisode(currentTime: string): Promise<any> {
    let time = this.parseTime(currentTime);
    let video = await this.getVideo();
    await new Promise(resolve => setTimeout(resolve, 3000));
    video.currentTime = time;
    video.play();
  }

}

class SerieDetails implements ISerieDetails {
  getId(): Promise<string> {
    const url = window.location.href;
    const matches = url.match(/vod\/details\/0\/([A-Za-z0-9]+)/);

    const serieId = matches ? matches[1] : null;
    if (!serieId) {
      return Promise.reject(new Error('Serie ID not found'));
    }

    return Promise.resolve(serieId);
  }

  getName(): Promise<string> {
    const serieNameElement = document.querySelector('.movies-name.text-bold.q-my-sm.text-h5');

    if (!serieNameElement) {
      return Promise.reject(new Error('Serie name element not found'));
    }

    return Promise.resolve(serieNameElement.textContent);
  }

  getEpisodes(): Promise<NodeListOf<HTMLButtonElement>> {
    const scrollAreaContentDiv = document.querySelector('.q-scrollarea__content.absolute');

    if (scrollAreaContentDiv) {
      const totalEpisodesDiv = scrollAreaContentDiv.querySelector('.row.no-wrap');

      if (totalEpisodesDiv) {
        const buttons = totalEpisodesDiv.querySelectorAll('button');
        return Promise.resolve(buttons);

      }
    }

    return Promise.reject(new Error('Episodes not found'));
  }

  getCurrentEpisode(buttons: NodeListOf<HTMLButtonElement>): Promise<number> {
    let selectedButtonIndex = -1;
    buttons.forEach((button, index) => {
      const span = button.querySelector('.q-btn__content.text-center.col.items-center.q-anchor--skip.justify-center.row');
      if (span) {
        const icon = span.querySelector('i.q-icon.notranslate.material-icons');
        if (icon) {
          selectedButtonIndex = index;
        }
      }
    });

    if (selectedButtonIndex !== -1) {
      return Promise.resolve(selectedButtonIndex);
    }

    return Promise.reject(new Error('Current episode not found'));
  }
}

class SerieService implements ISerieService {
  private serieDetails: ISerieDetails;

  constructor(serieDetails: ISerieDetails = new SerieDetails()) {
    this.serieDetails = serieDetails;
  }

  async nextEpisode(button: HTMLButtonElement): Promise<any> {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      button.click();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async getSerie(): Promise<SerieProgressDto> {
    const [id, name, episodes] = await Promise.all([
      this.serieDetails.getId(),
      this.serieDetails.getName(),
      this.serieDetails.getEpisodes()
    ]);

    return {
      serie: {
        id: id,
        name: name,
        episodes: episodes
      },
      currentEpisode: await this.serieDetails.getCurrentEpisode(episodes),
      qtdEpisodes: episodes.length,
    }
  }

  saveEpisodeDetails(serieId: string, episodeDetails: EpisodeDetailsDto): Promise<void> {
    localStorage.setItem(`currentEpisode-${serieId}`, JSON.stringify(episodeDetails));
    return Promise.resolve();
  }

  getEpisodeDetails(serieId: string): Promise<EpisodeDetailsDto> {
    const episodeDetails = localStorage.getItem(`currentEpisode-${serieId}`);

    if (episodeDetails) {
      return Promise.resolve(JSON.parse(episodeDetails));
    }

    return Promise.reject(new Error('Current episode not found'));
  }

}

class SeriesSettingsService {
  static key(serieId: string) {
    return `skipDelay-${serieId}`;
  }

  static getSkipDelay(serieId: string) {
    const raw = localStorage.getItem(this.key(serieId)) || '0';
    const secs = parseInt(raw, 10);
    return isNaN(secs) ? 0 : secs;
  }

  static saveSkipDelay(serieId: string, secs: number) {
    localStorage.setItem(this.key(serieId), String(Math.max(0, secs)));
  }
}


class Application {

  private serieService: ISerieService;
  private serieDetails: ISerieDetails;
  private videoService: IVideoService;

  constructor(serieService: ISerieService = new SerieService(), serieDetails: ISerieDetails = new SerieDetails(), videoService: IVideoService = new VideoService()) {
    this.videoService = videoService;
    this.serieService = serieService;
    this.serieDetails = serieDetails;
  }


  addSettingsPanel(serieId: string) {
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      backgroundColor: 'rgba(0,0,0,0.8)',
      color: '#fff',
      padding: '12px',
      borderRadius: '6px',
      zIndex: '9999',
      fontSize: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      width: '200px'
    });

    const title = document.createElement('div');
    title.textContent = 'Skip Delay';
    title.style.fontWeight = 'bold';
    title.style.textAlign = 'center';

    const sliderWrapper = document.createElement('div');
    Object.assign(sliderWrapper.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    });

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '240';
    slider.value = String(SeriesSettingsService.getSkipDelay(serieId));
    slider.style.flex = '1';

    const valueLabel = document.createElement('span');
    valueLabel.textContent = slider.value + 's';
    valueLabel.style.minWidth = '30px';
    valueLabel.style.textAlign = 'right';

    slider.addEventListener('input', () => {
      valueLabel.textContent = slider.value + 's';
    });

    const btn = document.createElement('button');
    btn.textContent = 'Salvar';
    Object.assign(btn.style, {
      padding: '6px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      backgroundColor: '#4CAF50',
      color: '#fff',
      fontWeight: 'bold'
    });
    btn.addEventListener('click', () => {
      const secs = Math.max(0, parseInt(slider.value, 10) || 0);
      SeriesSettingsService.saveSkipDelay(serieId, secs);
      btn.textContent = 'Salvo!';
      setTimeout(() => (btn.textContent = 'Salvar'), 1000);
    });

    sliderWrapper.append(slider, valueLabel);
    panel.append(title, sliderWrapper, btn);
    document.body.appendChild(panel);
  }

  async getYourProgress() {
    const serie = await this.serieService.getSerie();
    this.addSettingsPanel(serie.serie.id);

    try {
      const episodeDetails = await this.serieService.getEpisodeDetails(serie.serie.id);

      if (episodeDetails && episodeDetails.isFinished) {
        if (serie && serie.currentEpisode + 1 < serie.qtdEpisodes) {
          const episode = serie.serie.episodes[episodeDetails.currentEpisode + 1];
          await this.serieService.nextEpisode(episode);
        }
      }

      if (episodeDetails && !episodeDetails.isFinished) {
        const episode = serie.serie.episodes[episodeDetails.currentEpisode];
        await this.serieService.nextEpisode(episode);
        await this.videoService.continueEpisode(episodeDetails.currentTime);
      }

    } catch (error) {
      console.error(error);
    }

    try {
      const intervalId = setInterval(async () => {
        let progress = await this.videoService.getVideoProgress();
        let episodes = await this.serieDetails.getEpisodes();
        let currentEpisode = await this.serieDetails.getCurrentEpisode(episodes);
        serie.currentEpisode = currentEpisode;

        const episodeDetails: EpisodeDetailsDto = {
          currentEpisode: currentEpisode,
          duration: progress.duration,
          currentTime: progress.currentTime,
          isFinished: progress.isFinished
        };

        await this.serieService.saveEpisodeDetails(serie.serie.id, episodeDetails);

        let endEpisode = this.videoService.parseTime(episodeDetails.duration) - this.videoService.parseTime(episodeDetails.currentTime);

        if (progress.isFinished || endEpisode < SeriesSettingsService.getSkipDelay(serie.serie.id)) {
          if (serie && episodeDetails.currentEpisode + 1 < serie.qtdEpisodes) {
            const episode = serie.serie.episodes[episodeDetails.currentEpisode + 1];
            await this.serieService.nextEpisode(episode);
          } else {
            clearInterval(intervalId);
          }
        }

      }, 5000);
    } catch (error) {
      console.error(error);
    }
  }
}

const application = new Application();

application.getYourProgress().then();