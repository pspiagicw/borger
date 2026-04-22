package dashboard

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"borger/internal/borgmatic"
)

type dataSource interface {
	List(ctx context.Context) ([]borgmatic.ListEntry, error)
}

type Service struct {
	source dataSource
	nowFn  func() time.Time
}

func NewService(source dataSource, nowFn func() time.Time) *Service {
	return &Service{source: source, nowFn: nowFn}
}

type ViewModel struct {
	GeneratedAt  string
	Latest       *LatestBackupView
	Repositories []RepositoryView
	Error        string
}

type LatestBackupView struct {
	Repository string
	Timestamp  string
	Ago        string
}

type RepositoryView struct {
	Name      string
	Location  string
	Latest    string
	LatestAgo string
	Archives  []ArchiveView
}

type ArchiveView struct {
	Name      string
	Timestamp string
	Ago       string
}

type parsedArchive struct {
	Name string
	Time time.Time
}

func (s *Service) Build(ctx context.Context) ViewModel {
	now := s.nowFn().UTC()
	entries, err := s.source.List(ctx)
	if err != nil {
		return ViewModel{
			GeneratedAt: now.Format(time.RFC1123),
			Error:       err.Error(),
		}
	}

	repositories := make([]RepositoryView, 0, len(entries))
	var globalLatestRepo string
	var globalLatestTime time.Time
	foundLatest := false

	for _, entry := range entries {
		repoName := chooseRepoName(entry.Repository)
		parsed := make([]parsedArchive, 0, len(entry.Archives))

		for _, archive := range entry.Archives {
			archiveTime, ok := parseArchiveTime(archive)
			if !ok {
				continue
			}
			parsed = append(parsed, parsedArchive{Name: archive.Name, Time: archiveTime})
		}

		sort.Slice(parsed, func(i, j int) bool {
			return parsed[i].Time.After(parsed[j].Time)
		})

		repoView := RepositoryView{
			Name:     repoName,
			Location: entry.Repository.Location,
			Archives: make([]ArchiveView, 0, len(parsed)),
		}

		if len(parsed) > 0 {
			repoView.Latest = parsed[0].Time.Format("2006-01-02 15:04:05 MST")
			repoView.LatestAgo = timeAgo(now.Sub(parsed[0].Time))
		}

		for _, archive := range parsed {
			repoView.Archives = append(repoView.Archives, ArchiveView{
				Name:      archive.Name,
				Timestamp: archive.Time.Format("2006-01-02 15:04:05 MST"),
				Ago:       timeAgo(now.Sub(archive.Time)),
			})
		}

		if len(parsed) > 0 && (!foundLatest || parsed[0].Time.After(globalLatestTime)) {
			globalLatestRepo = repoName
			globalLatestTime = parsed[0].Time
			foundLatest = true
		}

		repositories = append(repositories, repoView)
	}

	sort.Slice(repositories, func(i, j int) bool {
		return strings.ToLower(repositories[i].Name) < strings.ToLower(repositories[j].Name)
	})

	vm := ViewModel{
		GeneratedAt:  now.Format(time.RFC1123),
		Repositories: repositories,
	}

	if foundLatest {
		vm.Latest = &LatestBackupView{
			Repository: globalLatestRepo,
			Timestamp:  globalLatestTime.Format("2006-01-02 15:04:05 MST"),
			Ago:        timeAgo(now.Sub(globalLatestTime)),
		}
	}

	return vm
}

func chooseRepoName(repo borgmatic.Repository) string {
	if repo.Label != "" {
		return repo.Label
	}
	if repo.Location == "" {
		return "Unknown Repository"
	}
	return repo.Location
}

func parseArchiveTime(archive borgmatic.Archive) (time.Time, bool) {
	candidates := []string{archive.Time, archive.Start}
	for _, value := range candidates {
		if value == "" {
			continue
		}

		for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.000000"} {
			t, err := time.Parse(layout, value)
			if err == nil {
				if t.Location() != time.UTC {
					t = t.UTC()
				}
				return t, true
			}
		}

		t, err := time.ParseInLocation("2006-01-02T15:04:05.000000", value, time.UTC)
		if err == nil {
			return t.UTC(), true
		}
	}
	return time.Time{}, false
}

func timeAgo(delta time.Duration) string {
	if delta < 0 {
		return "in the future"
	}
	if delta < time.Minute {
		return "just now"
	}

	units := []struct {
		name string
		dur  time.Duration
	}{
		{"day", 24 * time.Hour},
		{"hour", time.Hour},
		{"minute", time.Minute},
	}

	for _, unit := range units {
		if delta >= unit.dur {
			value := int(delta / unit.dur)
			suffix := unit.name
			if value > 1 {
				suffix += "s"
			}
			return fmt.Sprintf("%d %s ago", value, suffix)
		}
	}

	return "just now"
}
